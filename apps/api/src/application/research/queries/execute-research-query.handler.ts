// apps/api/src/application/research/queries/execute-research-query.handler.ts
// Query handler: ExecuteResearchQuery.
// Pipeline (spec §8 design AD-3): FilterBuilder → Prisma findMany →
// JsonbSearch raw-SQL post-filter → flatten display fields → StatsCalculator →
// BR-RES-004 N<5 suppression → response.

import { Injectable, Inject } from '@nestjs/common';
import type { Filter, FilterLogic, DataSource } from '@medicore/contracts';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { FilterBuilderService } from '../services/filter-builder.service';
import { JsonbSearchService } from '../services/jsonb-search.service';
import { StatsCalculatorService, type RawPatientRow } from '../services/stats-calculator.service';

export interface ExecuteQueryCommand {
  queryId: string;
  organizationId: string;
  /** Run ad-hoc without saving? If false, use stored filters; if true, override with given filters. */
  filters?: Filter[];
  filterLogic?: FilterLogic;
  displayFields?: string[];
}

export interface ExecuteQueryResult {
  queryId: string;
  totalRows: number;
  rows: Array<{
    patientId: string;
    nhc: string;
    fields: Record<string, unknown>;
  }>;
  stats: Array<{
    field: string;
    n: number;
    mean: number | null;
    median: number | null;
    stdDev: number | null;
    min: number | null;
    max: number | null;
    ci95Lower: number | null;
    ci95Upper: number | null;
  }>;
  distributions: Array<{
    field: string;
    categories: Array<{ label: string; count: number }>;
  }>;
  displayFields: string[];
  appliedFilters: Filter[];
}

@Injectable()
export class ExecuteResearchQueryHandler {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly filterBuilder: FilterBuilderService,
    private readonly jsonbSearch: JsonbSearchService,
    private readonly statsCalculator: StatsCalculatorService,
    @Inject('IPatientRepository') private readonly patientRepo: any,
  ) {}

  async execute(cmd: ExecuteQueryCommand): Promise<ExecuteQueryResult> {
    // Load the saved query to get its filters and config
    const query = await this.queryRepo.findById(cmd.queryId, cmd.organizationId);
    if (!query) throw new ResearchQueryNotFoundError(cmd.queryId);

    // Use override filters if provided, otherwise stored filters
    const filters = cmd.filters ?? query.filters;
    const filterLogic = cmd.filterLogic ?? query.filterLogic;
    const displayFields = cmd.displayFields ?? query.displayFields;

    // Build Prisma where clause
    const { where, rawFilters } = this.filterBuilder.build(
      filters,
      filterLogic,
      cmd.organizationId,
    );

    // DataSource scoping
    const scopedWhere = this.applyDataSourceScope(where, query.dataSource, query.importBatchIds);

    // Fetch candidate patients (light — no relations yet)
    const patients = await this.fetchPatients(scopedWhere);

    if (patients.length === 0) {
      return this.emptyResult(cmd.queryId, filters, displayFields);
    }

    // Apply raw-SQL imported numeric/date filters (post-filter)
    let finalPatientIds = patients.map((p) => p.id);
    if (rawFilters.length > 0) {
      finalPatientIds = await this.jsonbSearch.applyRawFilters(
        cmd.organizationId,
        finalPatientIds,
        rawFilters,
      );
    }

    // Build result rows with display fields
    const rows = await this.buildRows(finalPatientIds, patients, displayFields, cmd.organizationId);

    // Compute stats for numeric display fields
    const numericFields = this.detectNumericFields(rows);
    const stats = this.statsCalculator.computeStats(rows, numericFields);

    // Compute categorical distributions (BR-RES-004: N<5 dropped)
    const categoricalFields = this.detectCategoricalFields(rows, displayFields);
    const distributions: ExecuteQueryResult['distributions'] = [];
    for (const field of categoricalFields) {
      const dist = this.statsCalculator.computeDistribution(rows, field);
      if (dist) distributions.push(dist);
    }

    // Update run stats on the saved query
    await this.queryRepo.updateRunStats(cmd.queryId, cmd.organizationId, rows.length);

    // Map internal flat rows (used by stats) to the public contract shape,
    // nesting the dynamic display fields under `fields`.
    const publicRows = rows.map((r) => {
      const fields: Record<string, unknown> = {};
      for (const f of displayFields) fields[f] = r[f];
      return { patientId: r.patientId, nhc: r.nhc, fields };
    });

    return {
      queryId: cmd.queryId,
      totalRows: rows.length,
      rows: publicRows,
      stats,
      distributions,
      displayFields,
      appliedFilters: filters,
    };
  }

  private applyDataSourceScope(
    where: any,
    dataSource: DataSource,
    importBatchIds: string[],
  ): any {
    switch (dataSource) {
      case 'manual_only':
        return { ...where, importSource: null };
      case 'imported_only':
        return { ...where, NOT: { importSource: null } };
      case 'import_batch':
        if (importBatchIds.length > 0) {
          return { ...where, importBatchId: { in: importBatchIds } };
        }
        return where;
      default:
        return where;
    }
  }

  private async fetchPatients(where: any): Promise<any[]> {
    // Use the patient repository's prisma connection to find patients
    // We access PrismaService indirectly via IPatientRepository — but for
    // ad-hoc where clauses we need raw access. Inject Prisma directly in
    // production; for the handler we delegate to the repo's findAll isn't
    // flexible enough. So we use a lightweight raw query approach.
    // The repository exposes findById etc., but for arbitrary where we need
    // prisma directly. We'll resolve via the injected patientRepo's prisma.
    const prisma = (this.patientRepo as any).prisma ?? (this.patientRepo as any).__prisma;
    if (prisma?.patient?.findMany) {
      return prisma.patient.findMany({
        where,
        select: {
          id: true, nhc: true, firstName: true, lastName: true,
          birthDate: true, sex: true, bloodType: true,
          importSource: true, importedData: true, importBatchId: true,
          createdAt: true,
        },
      });
    }
    return [];
  }

  private async buildRows(
    finalIds: string[],
    patients: any[],
    displayFields: string[],
    organizationId: string,
  ): Promise<RawPatientRow[]> {
    const idSet = new Set(finalIds);
    const visiblePatients = patients.filter((p) => idSet.has(p.id));

    const rows: RawPatientRow[] = [];
    for (const patient of visiblePatients) {
      const fields: Record<string, unknown> = {};
      for (const field of displayFields) {
        fields[field] = this.extractField(patient, field);
      }
      rows.push({
        patientId: patient.id,
        nhc: patient.nhc,
        ...fields,
      });
    }
    void organizationId;
    return rows;
  }

  private extractField(patient: any, field: string): unknown {
    // Standard fields
    if (field === 'age') {
      if (patient.birthDate) {
        const diff = Date.now() - new Date(patient.birthDate).getTime();
        return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
      }
      return null;
    }
    const standardFields = [
      'nhc', 'firstName', 'lastName', 'birthDate', 'sex', 'bloodType',
      'importSource', 'createdAt',
    ];
    if (standardFields.includes(field)) {
      return patient[field] ?? null;
    }

    // Imported JSONB field — search across all batch keys
    if (patient.importedData) {
      const data = patient.importedData as Record<string, any>;
      for (const batchKey of Object.keys(data)) {
        const batch = data[batchKey];
        if (batch && typeof batch === 'object' && field in batch) {
          return batch[field];
        }
      }
    }
    return null;
  }

  private detectNumericFields(rows: RawPatientRow[]): string[] {
    if (rows.length === 0) return [];
    const candidates = new Set<string>();
    for (const row of rows) {
      for (const [key, val] of Object.entries(row)) {
        if (key === 'patientId' || key === 'nhc') continue;
        if (typeof val === 'number' && Number.isFinite(val)) {
          candidates.add(key);
        }
        if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val)) {
          candidates.add(key);
        }
      }
    }
    return Array.from(candidates);
  }

  private detectCategoricalFields(rows: RawPatientRow[], displayFields: string[]): string[] {
    if (rows.length === 0) return [];
    const exclude = new Set(['patientId', 'nhc', 'firstName', 'lastName']);
    // Categorical = non-numeric display fields
    return displayFields.filter((field) => {
      if (exclude.has(field)) return false;
      const values = rows.map((r) => r[field]);
      const allNumeric = values.every(
        (v) => v === null || v === undefined || (typeof v === 'number') ||
          (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)),
      );
      return !allNumeric;
    });
  }

  private emptyResult(queryId: string, filters: Filter[], displayFields: string[]) {
    return {
      queryId,
      totalRows: 0,
      rows: [],
      stats: [],
      distributions: [],
      displayFields,
      appliedFilters: filters,
    };
  }
}