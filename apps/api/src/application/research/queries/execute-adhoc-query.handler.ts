// apps/api/src/application/research/queries/execute-adhoc-query.handler.ts
// Ad-hoc query execution (spec §8): run filters WITHOUT persisting a
// ResearchQuery, with backend cursor-based pagination. Reuses the existing
// FilterBuilder → Prisma → JsonbSearch pipeline (design AD-3/AD-5).
// Stats are NOT computed here — only the cohort rows are paginated; descriptive
// stats are computed lazily by the caller (live preview is lightweight).
//
// Cursor: opaque base64 of the last patientId on the page (keyset pagination,
// stable by createdAt desc, id). Empty nextCursor → end of results.

import { Injectable, Inject } from '@nestjs/common';
import type { Filter, FilterLogic, DataSource, QueryResultRow } from '@medicore/contracts';
import { FilterBuilderService } from '../services/filter-builder.service';
import { JsonbSearchService } from '../services/jsonb-search.service';

export interface ExecuteAdHocQueryCommand {
  organizationId: string;
  filters: Filter[];
  filterLogic: FilterLogic;
  dataSource: DataSource;
  importBatchIds: string[];
  displayFields: string[];
  cursor?: string;
  limit: number;
}

export interface ExecuteAdHocQueryResult {
  items: QueryResultRow[];
  totalRows: number;
  nextCursor: string | null;
}

const STANDARD_SELECT = {
  id: true, nhc: true, firstName: true, lastName: true,
  birthDate: true, sex: true, bloodType: true,
  importSource: true, importedData: true, importBatchId: true,
  createdAt: true,
};

@Injectable()
export class ExecuteAdHocQueryHandler {
  constructor(
    private readonly filterBuilder: FilterBuilderService,
    private readonly jsonbSearch: JsonbSearchService,
    @Inject('IPatientRepository') private readonly patientRepo: any,
  ) {}

  async execute(cmd: ExecuteAdHocQueryCommand): Promise<ExecuteAdHocQueryResult> {
    const { where, rawFilters } = this.filterBuilder.build(
      cmd.filters,
      cmd.filterLogic,
      cmd.organizationId,
    );
    const scopedWhere = this.applyDataSourceScope(where, cmd.dataSource, cmd.importBatchIds);
    const patients = await this.fetchPatients(scopedWhere);

    if (patients.length === 0) {
      return { items: [], totalRows: 0, nextCursor: null };
    }

    let finalIds = patients.map((p) => p.id);
    if (rawFilters.length > 0) {
      finalIds = await this.jsonbSearch.applyRawFilters(
        cmd.organizationId,
        finalIds,
        rawFilters,
      );
    }

    // Cursor pagination — keyset by createdAt desc, id.
    const sorted = patients
      .filter((p) => finalIds.includes(p.id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id < a.id ? -1 : 1));
    const totalRows = sorted.length;

    const cursorId = cmd.cursor ? this.decodeCursor(cmd.cursor) : undefined;
    let startIdx = 0;
    if (cursorId) {
      startIdx = sorted.findIndex((p) => p.id === cursorId) + 1;
      if (startIdx === 0) startIdx = 0; // cursor stale → start from top
    }

    const page = sorted.slice(startIdx, startIdx + cmd.limit);
    const hasMore = startIdx + cmd.limit < totalRows;

    const items: QueryResultRow[] = page.map((p) => {
      const fields: Record<string, unknown> = {};
      for (const f of cmd.displayFields) fields[f] = this.extractField(p, f);
      return { patientId: p.id, nhc: p.nhc, fields };
    });

    return {
      items,
      totalRows,
      nextCursor: hasMore && page.length > 0
        ? this.encodeCursor(page[page.length - 1].id)
        : null,
    };
  }

  private extractField(patient: any, field: string): unknown {
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
    if (standardFields.includes(field)) return patient[field] ?? null;
    if (patient.importedData) {
      const data = patient.importedData as Record<string, any>;
      for (const batchKey of Object.keys(data)) {
        const batch = data[batchKey];
        if (batch && typeof batch === 'object' && field in batch) return batch[field];
      }
    }
    return null;
  }

  private encodeCursor(patientId: string): string {
    return Buffer.from(`pid:${patientId}`).toString('base64url');
  }

  private decodeCursor(cursor: string): string | undefined {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      return decoded.startsWith('pid:') ? decoded.slice(4) : undefined;
    } catch {
      return undefined;
    }
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
    const prisma = (this.patientRepo as any).prisma ?? (this.patientRepo as any).__prisma;
    if (prisma?.patient?.findMany) {
      return prisma.patient.findMany({ where, select: { ...STANDARD_SELECT } });
    }
    return [];
  }
}