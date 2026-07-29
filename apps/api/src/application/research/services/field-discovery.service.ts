// apps/api/src/application/research/services/field-discovery.service.ts
// Field discovery (spec §5, design AD-3): introspects Patient.importedData
// across all batch keys and suggests fields with inferred types
// (string | number | date | boolean), non-null counts, and up to 5 example
// values. Catalog is cached per organization (TTL 1h) and invalidated on
// import completion (FieldCatalogCachePort).
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
    const cached = await this.cache.get(organizationId);
    let entries: FieldCatalogEntry[];
    if (cached) {
      entries = cached.entries;
    } else {
      entries = await this.generateCatalog(organizationId);
      await this.cache.set(organizationId, {
        entries,
        generatedAt: new Date().toISOString(),
      });
    }
    return this.filterEntries(entries, query, type);
  }

  /** Invalidate the cached catalog — called by ImportProcessor on completion. */
  async invalidate(organizationId: string): Promise<void> {
    await this.cache.invalidate(organizationId);
  }

  // ─────────────────────────────────────────────
  // Catalog generation
  // ─────────────────────────────────────────────

  private async generateCatalog(organizationId: string): Promise<FieldCatalogEntry[]> {
    // 1. Real non-null counts per imported field across the whole org.
    const countRows = await this.prisma.$queryRawUnsafe<
      Array<{ field: string; n: bigint }>
    >(
      `SELECT kv.field AS field, COUNT(DISTINCT p.id) AS n
       FROM patients p,
            jsonb_each_text(COALESCE(p.imported_data, '{}'::jsonb)) AS b(k, batch_val),
            jsonb_each_text(batch_val) AS kv(field, value)
       WHERE p.organization_id = $1
         AND p.deleted_at IS NULL
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
         SELECT id, imported_data
         FROM patients
         WHERE organization_id = $1 AND deleted_at IS NULL
           AND imported_data IS NOT NULL
         ORDER BY created_at DESC
         LIMIT $2
       ) p,
            jsonb_each_text(p.imported_data) AS b(k, batch_val),
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

    // 3. Build imported entries.
    const importedEntries: FieldCatalogEntry[] = [];
    for (const [field, values] of valuesByField) {
      const type = this.inferType(values);
      const examples = this.collectExamples(values, 5);
      importedEntries.push({
        field,
        source: 'imported',
        type,
        nonNullCount: nonNullCounts.get(field) ?? 0,
        examples,
      });
    }

    // 4. Standard fields always present (counts computed once for accuracy).
    const totalPatients = await this.countPatients(organizationId);
    const standardEntries: FieldCatalogEntry[] = STANDARD_FIELDS.map((def) => ({
      field: def.field,
      source: 'standard' as FieldSourceV2,
      type: def.type,
      nonNullCount: totalPatients,
      examples: this.standardExamples(def.field, def.type),
    }));

    // 5. Merge, imported first then standard, sort by nonNullCount desc.
    const merged = [...importedEntries, ...standardEntries];
    merged.sort((a, b) => b.nonNullCount - a.nonNullCount || a.field.localeCompare(b.field));
    return merged;
  }

  private async countPatients(organizationId: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM patients
       WHERE organization_id = $1 AND deleted_at IS NULL`,
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
      result = result.filter((e) => e.field.toLowerCase().includes(q));
    }
    return result;
  }
}