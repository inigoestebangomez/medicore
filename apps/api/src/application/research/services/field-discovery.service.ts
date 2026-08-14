// apps/api/src/application/research/services/field-discovery.service.ts
// Field discovery (spec §5, design AD-3): introspects Patient.importedData
// across all batch keys and suggests fields with inferred types
// (string | number | date | boolean), non-null counts, up to 5 example values,
// and import provenance. Catalog is cached per organization (TTL 1h) and
// invalidated on import completion (FieldCatalogCachePort).
//
// Standard typed Patient columns are always present in the catalog so the
// autocomplete surfaces both imported and standard fields uniformly.

import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { FieldCatalogCachePort } from '../ports/field-catalog-cache.port';
import type {
  FieldCatalogEntry,
  FieldType,
  FieldSourceV2,
} from '@medicore/contracts';

/** Sample size used for type inference + example values (price of catalog gen). */
const DISCOVERY_SAMPLE = 400;

interface StandardFieldDef {
  field: string;
  type: FieldType;
}

interface CatalogData {
  entries: FieldCatalogEntry[];
  totalPatients: number;
}

interface ImportBatchMetadata {
  id: string;
  fileName: string;
  originalFormat: string;
  importedAt: string;
  columnMapping: Record<string, unknown>;
  customFieldNames: Record<string, unknown>;
}

interface MutableFieldMetadata {
  label?: string;
  originalHeaders: Set<string>;
  batches: Map<string, ImportBatchMetadata>;
}

const STANDARD_FIELDS: StandardFieldDef[] = [
  { field: 'nhc', type: 'string' },
  { field: 'firstName', type: 'string' },
  { field: 'lastName', type: 'string' },
  { field: 'sex', type: 'string' },
  { field: 'bloodType', type: 'string' },
  { field: 'birthDate', type: 'date' },
  { field: 'importSource', type: 'string' },
  { field: 'createdAt', type: 'date' },
  { field: 'age', type: 'number' }, // computed from birthDate
];

const STANDARD_FIELD_LABELS: Record<string, string> = {
  nhc: 'Número de historia clínica',
  firstName: 'Nombre',
  lastName: 'Apellidos',
  sex: 'Sexo',
  bloodType: 'Grupo sanguíneo',
  birthDate: 'Fecha de nacimiento',
  importSource: 'Fuente de importación',
  createdAt: 'Fecha de alta',
  age: 'Edad',
};

const STANDARD_FIELD_KEYS = new Set(STANDARD_FIELDS.map(({ field }) => field));

@Injectable()
export class FieldDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('FieldCatalogCachePort') private readonly cache: FieldCatalogCachePort,
  ) {}

  /**
   * Return the catalog entries for an org, optionally filtered by free-text
   * `query` and/or `type`. Uses the per-org cached catalog (AD-3), generating
   * it on miss.
   */
  async getCatalog(
    organizationId: string,
    query: string,
    type?: FieldType,
  ): Promise<FieldCatalogEntry[]> {
    const result = await this.getCatalogResponse(organizationId, query, type);
    return result.entries;
  }

  /** Response shape used by the HTTP endpoint; getCatalog remains list-compatible. */
  async getCatalogResponse(
    organizationId: string,
    query: string,
    type?: FieldType,
  ): Promise<{ entries: FieldCatalogEntry[]; totalPatients?: number }> {
    const catalog = await this.loadCatalog(organizationId);
    return {
      entries: this.filterEntries(catalog.entries, query, type),
      totalPatients: catalog.totalPatients,
    };
  }

  /** Invalidate the cached catalog — called by ImportProcessor on completion. */
  async invalidate(organizationId: string): Promise<void> {
    await this.cache.invalidate(organizationId);
  }

  // ─────────────────────────────────────────────
  // Catalog generation
  // ─────────────────────────────────────────────

  private async loadCatalog(organizationId: string): Promise<CatalogData> {
    const cached = await this.cache.get(organizationId);
    if (cached) {
      const inferredTotal = this.totalPatientsFromEntries(cached.entries);
      return {
        entries: cached.entries,
        totalPatients: cached.totalPatients ?? inferredTotal,
      };
    }

    const catalog = await this.generateCatalog(organizationId);
    await this.cache.set(organizationId, {
      entries: catalog.entries,
      totalPatients: catalog.totalPatients,
      generatedAt: new Date().toISOString(),
    });
    return catalog;
  }

  private async generateCatalog(organizationId: string): Promise<CatalogData> {
    // 1. Real non-null counts per imported field across the whole org.
    const countRows = await this.prisma.$queryRawUnsafe<
      Array<{ field: string; n: bigint }>
    >(
      `SELECT kv.field AS field, COUNT(DISTINCT p."id") AS n
       FROM patients p,
             jsonb_each(p."importedData") AS b(k, batch_val),
             jsonb_each_text(batch_val) AS kv(field, value)
       WHERE p."organizationId" = $1
         AND p."deletedAt" IS NULL
         AND p."importedData" IS NOT NULL
         AND kv.value IS NOT NULL
         AND kv.value::text <> ''
       GROUP BY kv.field`,
      organizationId,
    );
    const nonNullCounts = new Map<string, number>();
    for (const row of countRows) {
      nonNullCounts.set(row.field, Number(row.n));
    }

    // 2. Sample patients for example values (up to 5 distinct) + type inference.
    const sampleRows = await this.prisma.$queryRawUnsafe<
      Array<{ field: string; value: string }>
    >(
      `SELECT kv.field AS field, kv.value::text AS value
       FROM (
         SELECT "id", "importedData"
         FROM patients
         WHERE "organizationId" = $1 AND "deletedAt" IS NULL
           AND "importedData" IS NOT NULL
         ORDER BY "createdAt" DESC
         LIMIT $2
       ) p,
            jsonb_each(p."importedData") AS b(k, batch_val),
            jsonb_each_text(batch_val) AS kv(field, value)
       WHERE kv.value IS NOT NULL AND kv.value::text <> ''`,
      organizationId,
      DISCOVERY_SAMPLE,
    );

    // Bucket sample values per field.
    const valuesByField = new Map<string, string[]>();
    for (const row of sampleRows) {
      const arr = valuesByField.get(row.field) ?? [];
      arr.push(row.value);
      valuesByField.set(row.field, arr);
    }

    // 3. Import metadata is queried separately so sample rows never leave this service.
    const [totalPatients, batches] = await Promise.all([
      this.countPatients(organizationId),
      this.loadImportBatchMetadata(organizationId),
    ]);
    const metadataByField = this.buildMetadataByField(batches);

    // 4. Build imported entries.
    const importedEntries: FieldCatalogEntry[] = [];
    for (const [field, values] of valuesByField) {
      const type = this.inferType(values);
      const examples = this.collectExamples(values, 5);
      importedEntries.push(this.enrichEntry({
        field,
        source: 'imported',
        type,
        nonNullCount: nonNullCounts.get(field) ?? 0,
        examples,
      }, metadataByField.get(field), totalPatients));
    }

    // 5. Standard fields always present (counts computed once for accuracy).
    const standardEntries: FieldCatalogEntry[] = STANDARD_FIELDS.map((def) => this.enrichEntry({
      field: def.field,
      source: 'standard' as FieldSourceV2,
      type: def.type,
      nonNullCount: totalPatients,
      examples: this.standardExamples(def.field, def.type),
    }, metadataByField.get(def.field), totalPatients, STANDARD_FIELD_LABELS[def.field]));

    // 6. Merge, imported first then standard, sort by nonNullCount desc.
    const merged = [...importedEntries, ...standardEntries];
    merged.sort((a, b) => b.nonNullCount - a.nonNullCount || a.field.localeCompare(b.field));
    return { entries: merged, totalPatients };
  }

  private totalPatientsFromEntries(entries: FieldCatalogEntry[]): number {
    return entries.find((entry) => entry.totalCount !== undefined)?.totalCount ?? 0;
  }

  private async loadImportBatchMetadata(organizationId: string): Promise<ImportBatchMetadata[]> {
    // Unit-test doubles from before provenance support do not expose importBatch.
    const importBatch = (this.prisma as any).importBatch;
    if (!importBatch?.findMany) return [];

    const rows = await importBatch.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        fileName: true,
        originalFormat: true,
        createdAt: true,
        columnMapping: true,
        customFieldNames: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row: any) => ({
      id: row.id,
      fileName: row.fileName,
      originalFormat: row.originalFormat,
      importedAt: new Date(row.createdAt).toISOString(),
      columnMapping: this.asRecord(row.columnMapping),
      customFieldNames: this.asRecord(row.customFieldNames),
    }));
  }

  private buildMetadataByField(batches: ImportBatchMetadata[]): Map<string, MutableFieldMetadata> {
    const result = new Map<string, MutableFieldMetadata>();
    const register = (field: string, label: unknown, header: string, batch: ImportBatchMetadata) => {
      if (!field || field === 'ignore') return;
      const current = result.get(field) ?? {
        originalHeaders: new Set<string>(),
        batches: new Map<string, ImportBatchMetadata>(),
      };
      if (typeof label === 'string' && label.trim() && !current.label) current.label = label.trim();
      current.originalHeaders.add(header);
      current.batches.set(batch.id, batch);
      result.set(field, current);
    };

    for (const batch of batches) {
      const mapping = batch.columnMapping;
      for (const header of new Set([...Object.keys(mapping), ...Object.keys(batch.customFieldNames)])) {
        const mappedField = mapping[header];
        if (mappedField === 'ignore') continue;
        const importedLabel = batch.customFieldNames[header];
        if (mappedField === 'custom' || mappedField === undefined) {
          // Custom values are persisted under their original Excel header in
          // Patient.importedData. A standard mapping must not create a second
          // phantom imported field for the header (e.g. "Edad" alongside age).
          register(header, importedLabel ?? header, header, batch);
        } else if (typeof mappedField === 'string') {
          // Mapped clinical values are persisted under their normalized field
          // key in the imported batch block, while the original header remains
          // useful provenance for the catalog entry.
          register(
            mappedField,
            STANDARD_FIELD_KEYS.has(mappedField)
              ? STANDARD_FIELD_LABELS[mappedField]
              : importedLabel ?? mappedField,
            header,
            batch,
          );
        }
      }
    }
    return result;
  }

  private enrichEntry(
    entry: Omit<FieldCatalogEntry, 'label' | 'unit' | 'originalHeaders' | 'batches' | 'totalCount' | 'completenessPercent'>,
    metadata: MutableFieldMetadata | undefined,
    totalPatients: number,
    defaultLabel?: string,
  ): FieldCatalogEntry {
    const completenessPercent = totalPatients > 0
      ? Math.min(100, Math.round((entry.nonNullCount / totalPatients) * 100))
      : 0;
    const originalHeaders = metadata ? Array.from(metadata.originalHeaders).sort() : [];
    const unit = this.inferUnit(entry.field, originalHeaders);
    return {
      ...entry,
      label: defaultLabel ?? metadata?.label ?? entry.field,
      ...(unit ? { unit } : {}),
      ...(originalHeaders.length ? { originalHeaders } : {}),
      ...(metadata?.batches.size ? { batches: Array.from(metadata.batches.values()).map(({ id, fileName, originalFormat, importedAt }) => ({ id, fileName, originalFormat, importedAt })) } : {}),
      totalCount: totalPatients,
      completenessPercent,
    };
  }

  private inferUnit(field: string, originalHeaders: string[]): string | undefined {
    const header = [field, ...originalHeaders].join(' ').toLocaleLowerCase();
    if (/\b(imc|bmi)\b/.test(header)) return 'kg/m²';
    if (/\b(peso|weight)\b/.test(header)) return 'kg';
    if (/\b(talla|altura|estatura|height)\b/.test(header)) return 'cm';
    if (/\b(edad|age)\b/.test(header)) return 'años';
    if (/\b(eva|dolor|score|puntuaci[oó]n|puntuacion)\b/.test(header)) return 'puntos';
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private async countPatients(organizationId: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM patients
       WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
      organizationId,
    );
    return Number(rows[0]?.n ?? 0);
  }

  // ─────────────────────────────────────────────
  // Type inference (dominant type across sampled values)
  // ─────────────────────────────────────────────

  private inferType(values: string[]): FieldType {
    const counts = { number: 0, date: 0, boolean: 0, string: 0 };
    const numericRe = /^-?[0-9]+(\.[0-9]+)?$/;
    const dateRe = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
    for (const v of values) {
      if (v === 'true' || v === 'false') counts.boolean++;
      else if (dateRe.test(v)) counts.date++;
      else if (numericRe.test(v)) counts.number++;
      else counts.string++;
    }
    // Dominant type — string wins ties (safe default).
    const winner = (Object.entries(counts) as Array<[FieldType, number]>).sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    return winner;
  }

  private collectExamples(values: string[], max: number): unknown[] {
    const seen = new Set<string>();
    const examples: unknown[] = [];
    for (const v of values) {
      if (seen.has(v)) continue;
      seen.add(v);
      examples.push(this.coerceExample(v, this.inferType([v])));
      if (examples.length >= max) break;
    }
    return examples;
  }

  private coerceExample(raw: string, type: FieldType): unknown {
    switch (type) {
      case 'number': {
        const n = Number(raw);
        return Number.isNaN(n) ? raw : n;
      }
      case 'boolean':
        return raw === 'true';
      case 'date':
        return raw;
      default:
        return raw;
    }
  }

  private standardExamples(field: string, _type: FieldType): unknown[] {
    // Static representative examples for standard fields (no PHI surfaced).
    const map: Record<string, unknown[]> = {
      nhc: ['NHC-001', 'NHC-002'],
      firstName: ['(nombre)'],
      lastName: ['(apellido)'],
      sex: ['M', 'F'],
      bloodType: ['O+', 'A+', 'B+'],
      birthDate: ['1980-01-15', '1992-07-22'],
      importSource: ['excel', 'csv'],
      createdAt: ['2026-01-10', '2026-03-04'],
      age: [42, 67],
    };
    return map[field] ?? [];
  }

  // ─────────────────────────────────────────────
  // Filtering
  // ─────────────────────────────────────────────

  private filterEntries(
    entries: FieldCatalogEntry[],
    query: string,
    type?: FieldType,
  ): FieldCatalogEntry[] {
    let result = entries;
    if (type) {
      result = result.filter((e) => e.type === type);
    }
    if (query && query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      result = result.filter((e) => [e.field, e.label, ...(e.originalHeaders ?? [])]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q)));
    }
    return result;
  }
}
