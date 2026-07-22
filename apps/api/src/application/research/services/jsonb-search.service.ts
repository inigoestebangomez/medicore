// apps/api/src/application/research/services/jsonb-search.service.ts
// Raw-SQL escape hatch for JSONB queries that Prisma can't express (design AD-3).
// Imported numeric/date comparisons across batch keys in importedData require
// `jsonb_each_text` to traverse the top-level batch-key → field-value nesting.
//
// importedData structure: { "batchId1": { "EVA": 8, "Tiempo": 138 }, "batchId2": { ... } }
// To filter "EVA > 5" we must iterate all batch keys and check if ANY has EVA > 5.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { RawSqlFilter } from './filter-builder.service';

export interface JsonbSearchResult {
  patientIds: string[];
}

@Injectable()
export class JsonbSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply raw-SQL imported filters and return the set of patient IDs that match.
   * The FilterBuilder already applied the base Prisma where; this finds which
   * of those patients also satisfy the imported numeric/date conditions.
   *
   * Strategy: for each raw filter, run a parameterized SQL query that uses
   * `jsonb_each_text` to traverse importedData batch keys and casts the value
   * to numeric for comparison.
   */
  async applyRawFilters(
    organizationId: string,
    candidateIds: string[],
    rawFilters: RawSqlFilter[],
  ): Promise<string[]> {
    if (rawFilters.length === 0 || candidateIds.length === 0) {
      return candidateIds;
    }

    let matchingIds = new Set(candidateIds);

    for (const filter of rawFilters) {
      const ids = await this.queryRawFilter(organizationId, filter, candidateIds);
      matchingIds = new Set(ids.filter((id) => matchingIds.has(id)));
    }

    return Array.from(matchingIds);
  }

  /**
   * Extract all numeric values for a given imported field across all patients
   * and all batch keys. Used by StatsCalculatorService for cross-batch
   * aggregation (design AD-5).
   */
  async extractNumericValues(
    organizationId: string,
    field: string,
    patientIds: string[],
  ): Promise<number[]> {
    if (patientIds.length === 0) return [];

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ value: string }>
    >(
      `SELECT (kv.value::text)::numeric AS value
       FROM patients p,
            jsonb_each_text(p.imported_data) AS b(k, batch_val),
            jsonb_each_text(batch_val) AS kv(field, value)
       WHERE p.organization_id = $1
         AND p.id = ANY($2)
         AND kv.field = $3
         AND kv.value::text ~ '^-?[0-9]+(\\.[0-9]+)?$'`,
      organizationId,
      patientIds,
      field,
    );

    return rows
      .map((r) => Number(r.value))
      .filter((n) => !Number.isNaN(n));
  }

  private async queryRawFilter(
    organizationId: string,
    filter: RawSqlFilter,
    candidateIds: string[],
  ): Promise<string[]> {
    switch (filter.operator) {
      case 'greater_than':
        return this.rawQuery(
          organizationId, filter.field, '>', filter.value, candidateIds,
        );
      case 'less_than':
        return this.rawQuery(
          organizationId, filter.field, '<', filter.value, candidateIds,
        );
      case 'between':
        return this.rawBetweenQuery(
          organizationId, filter.field, filter.value, filter.valueTo, candidateIds,
        );
      case 'date_before':
      case 'date_after':
      case 'date_between':
        return this.rawDateQuery(organizationId, filter, candidateIds);
      default:
        return candidateIds;
    }
  }

  /**
   * Raw SQL: find patients where ANY batch in importedData has `field` with a
   * numeric value satisfying the comparison. Uses jsonb_each_text to traverse
   * the two-level JSONB nesting (batch keys → field values).
   */
  private async rawQuery(
    organizationId: string,
    field: string,
    op: '>' | '<',
    threshold: string | number,
    candidateIds: string[],
  ): Promise<string[]> {
    const thresholdNum = Number(threshold);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string }>
    >(
      `SELECT DISTINCT p.id
       FROM patients p,
            jsonb_each_text(p.imported_data) AS b(k, batch_val),
            jsonb_each_text(batch_val) AS kv(field, value)
       WHERE p.organization_id = $1
         AND p.id = ANY($2)
         AND kv.field = $3
         AND (kv.value::text) ~ '^-?[0-9]+(\\.[0-9]+)?$'
         AND (kv.value::text)::numeric ${op} $4`,
      organizationId,
      candidateIds,
      field,
      thresholdNum,
    );
    return rows.map((r) => r.id);
  }

  private async rawBetweenQuery(
    organizationId: string,
    field: string,
    low: string | number,
    high: string | number | undefined,
    candidateIds: string[],
  ): Promise<string[]> {
    if (high === undefined) return candidateIds;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string }>
    >(
      `SELECT DISTINCT p.id
       FROM patients p,
            jsonb_each_text(p.imported_data) AS b(k, batch_val),
            jsonb_each_text(batch_val) AS kv(field, value)
       WHERE p.organization_id = $1
         AND p.id = ANY($2)
         AND kv.field = $3
         AND (kv.value::text) ~ '^-?[0-9]+(\\.[0-9]+)?$'
         AND (kv.value::text)::numeric BETWEEN $4 AND $5`,
      organizationId,
      candidateIds,
      field,
      Number(low),
      Number(high),
    );
    return rows.map((r) => r.id);
  }

  private async rawDateQuery(
    organizationId: string,
    filter: RawSqlFilter,
    candidateIds: string[],
  ): Promise<string[]> {
    // Imported date fields are stored as text. Cast to date for comparison.
    let dateClause = '';
    const params: unknown[] = [organizationId, candidateIds, filter.field];

    switch (filter.operator) {
      case 'date_before':
        dateClause = 'kv.value::text::date < $4';
        params.push(String(filter.value));
        break;
      case 'date_after':
        dateClause = 'kv.value::text::date > $4';
        params.push(String(filter.value));
        break;
      case 'date_between':
        dateClause = 'kv.value::text::date BETWEEN $4 AND $5';
        params.push(String(filter.value), String(filter.valueTo));
        break;
      default:
        return candidateIds;
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string }>
    >(
      `SELECT DISTINCT p.id
       FROM patients p,
            jsonb_each_text(p.imported_data) AS b(k, batch_val),
            jsonb_each_text(batch_val) AS kv(field, value)
       WHERE p.organization_id = $1
         AND p.id = ANY($2)
         AND kv.field = $3
         AND kv.value::text ~ '^\\d{4}-\\d{2}-\\d{2}'
         AND ${dateClause}`,
      ...params,
    );
    return rows.map((r) => r.id);
  }
}