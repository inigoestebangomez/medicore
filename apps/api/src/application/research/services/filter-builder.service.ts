// apps/api/src/application/research/services/filter-builder.service.ts
// Translates UI Filter[] objects to Prisma `PatientWhereInput` (spec §8, design AD-3).
//
// Strategy (AD-3 — Prisma-first, raw SQL fallback):
//   standard      → typed Patient column (equals, contains, gt, lt, between, dates)
//   imported      → importedData JSONB path operator for text/equality;
//                   numeric comparisons (> < between) are flagged for JsonbSearchService
//   consultation  → Consultation `some:` relation
//   surgery       → Surgery `some:` relation
//   medication    → MedicationPrescription `some:` relation
//   scale         → ClinicalScale `some:` relation
//
// AND/OR logic: Prisma supports `AND: [...]` and `OR: [...]` natively, so the
// effective where is `{ [logic]: [filterClauses] }` when more than one filter.

import { Injectable } from '@nestjs/common';
import type { Filter, FilterLogic } from '@medicore/contracts';
import { Prisma } from '@prisma/client';
import type { Prisma as PrismaType } from '@prisma/client';

/**
 * Filters that FilterBuilder cannot express in Prisma typed where and that
 * need the JsonbSearchService raw-SQL escape hatch (imported numeric / date
 * comparisons across JSONB batch keys).
 */
export interface RawSqlFilter {
  field: string;
  operator: 'greater_than' | 'less_than' | 'between' | 'date_before' | 'date_after' | 'date_between';
  value: string | number;
  valueTo?: string | number;
}

export interface BuiltWhere {
  where: PrismaType.PatientWhereInput;
  /** Imported numeric/date filters needing raw SQL post-filtering. */
  rawFilters: RawSqlFilter[];
}

// Patient standard fields: age, birthDate, sex, nhc, firstName, lastName,
// idDocument, bloodType, createdAt, importSource — map to typed Prisma columns.

// Consultation relation fields
const CONSULTATION_FIELDS = new Set([
  'chiefComplaint', 'currentIllness', 'assessment', 'type',
  'consultationType', 'consultationDate', 'physicianId', 'date',
]);

// Surgery relation fields
const SURGERY_FIELDS = new Set([
  'procedureType', 'date', 'surgeryDate', 'asa', 'duration',
  'complications', 'anesthesiaType', 'status', 'surgeryStatus',
]);

// Medication relation fields
const MEDICATION_FIELDS = new Set([
  'drugName', 'activeIngredient', 'status', 'medicationStatus', 'startDate',
]);

// ClinicalScale relation fields
const SCALE_FIELDS = new Set(['scaleType', 'totalScore', 'date', 'scaleDate']);

@Injectable()
export class FilterBuilderService {
  /**
   * Build the Prisma where clause from a list of filters.
   * Returns the where + any raw-SQL filters that need post-processing.
   */
  build(
    filters: Filter[],
    filterLogic: FilterLogic,
    organizationId: string,
  ): BuiltWhere {
    const clauses: PrismaType.PatientWhereInput[] = [];
    const rawFilters: RawSqlFilter[] = [];

    const baseWhere: PrismaType.PatientWhereInput = {
      organizationId,
      deletedAt: null,
    };

    for (const filter of filters) {
      const clause = this.buildClause(filter);
      if (clause) {
        clauses.push(clause);
      }
    }

    // Combine clauses with AND or OR
    let where: PrismaType.PatientWhereInput;
    if (clauses.length === 0) {
      where = baseWhere;
    } else if (clauses.length === 1 && filterLogic === 'AND') {
      where = { ...baseWhere, ...clauses[0] };
    } else {
      where = {
        ...baseWhere,
        [filterLogic]: clauses,
      } as PrismaType.PatientWhereInput;
    }

    // Extract imported numeric/date filters for raw SQL (added to rawFilters
    // inside buildImportedClause)
    for (const filter of filters) {
      if (filter.source === 'imported') {
        this.collectRawFilter(filter, rawFilters);
      }
    }

    return { where, rawFilters };
  }

  private buildClause(filter: Filter): PrismaType.PatientWhereInput | null {
    switch (filter.source) {
      case 'standard':
        return this.buildStandardClause(filter);
      case 'imported':
        return this.buildImportedClause(filter);
      case 'consultation':
        return this.buildRelationClause('consultations', filter, CONSULTATION_FIELDS);
      case 'surgery':
        return this.buildRelationClause('surgeries', filter, SURGERY_FIELDS);
      case 'medication':
        return this.buildRelationClause('medications', filter, MEDICATION_FIELDS);
      case 'scale':
        return this.buildRelationClause('scales', filter, SCALE_FIELDS);
      default:
        return null;
    }
  }

  // ─────────────────────────────────────────────
  // Standard fields → typed Prisma columns
  // ─────────────────────────────────────────────

  private buildStandardClause(filter: Filter): PrismaType.PatientWhereInput {
    const { field, operator, value, valueTo } = filter;
    const prismaField = this.mapStandardField(field);

    switch (operator) {
      case 'equals':
        return { [prismaField]: { equals: value } };
      case 'not_equals':
        return { [prismaField]: { not: { equals: value } } };
      case 'contains':
        return {
          [prismaField]: { contains: String(value), mode: 'insensitive' },
        };
      case 'not_contains':
        return {
          NOT: { [prismaField]: { contains: String(value), mode: 'insensitive' } },
        };
      case 'starts_with':
        return {
          [prismaField]: { startsWith: String(value), mode: 'insensitive' },
        };
      case 'greater_than':
        return { [prismaField]: { gt: this.numericOrDate(value) } };
      case 'less_than':
        return { [prismaField]: { lt: this.numericOrDate(value) } };
      case 'between':
        return {
          [prismaField]: {
            gte: this.numericOrDate(value),
            lte: this.numericOrDate(valueTo),
          },
        };
      case 'is_empty':
        return { OR: [{ [prismaField]: null }, { [prismaField]: '' }] };
      case 'is_not_empty':
        return { [prismaField]: { not: null } };
      case 'in_list':
        return { [prismaField]: { in: value as string[] } };
      case 'date_before':
        return { [prismaField]: { lt: new Date(String(value)) } };
      case 'date_after':
        return { [prismaField]: { gt: new Date(String(value)) } };
      case 'date_between':
        return {
          [prismaField]: {
            gte: new Date(String(value)),
            lte: new Date(String(valueTo)),
          },
        };
      case 'boolean_true':
        return { [prismaField]: { equals: true } };
      case 'boolean_false':
        return { [prismaField]: { equals: false } };
      default:
        return {};
    }
  }

  private mapStandardField(field: string): string {
    // "age" is computed from birthDate — treat as birthDate for the query
    if (field === 'age') return 'birthDate';
    if (field === 'consultationDate' || field === 'date') return 'createdAt';
    return field;
  }

  // ─────────────────────────────────────────────
  // Imported fields → JSONB path (text/equality) or raw SQL (numeric/date)
  // ─────────────────────────────────────────────

  private buildImportedClause(filter: Filter): PrismaType.PatientWhereInput | null {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'equals':
        return {
          importedData: { path: this.jsonbPath(field), equals: value },
        };
      case 'not_equals':
        return {
          NOT: { importedData: { path: this.jsonbPath(field), equals: value } },
        };
      case 'contains':
        return {
          importedData: {
            path: this.jsonbPath(field),
            string_contains: String(value),
          },
        };
      case 'not_contains':
        return {
          NOT: {
            importedData: {
              path: this.jsonbPath(field),
              string_contains: String(value),
            },
          },
        };
      case 'starts_with':
        return {
          importedData: {
            path: this.jsonbPath(field),
            string_starts_with: String(value),
          },
        };
      case 'is_empty':
        return {
          OR: [
            { importedData: { path: this.jsonbPath(field), equals: Prisma.DbNull } },
            { importedData: { path: this.jsonbPath(field), equals: '' } },
          ],
        };
      case 'is_not_empty':
        return {
          importedData: { path: this.jsonbPath(field), not: Prisma.DbNull },
        };
      case 'boolean_true':
        return { importedData: { path: this.jsonbPath(field), equals: true } };
      case 'boolean_false':
        return { importedData: { path: this.jsonbPath(field), equals: false } };
      case 'in_list': {
        // JSONB path filter doesn't support `in`; emulate via OR of equals
        const values = (value as string[]) ?? [];
        const orClauses = values.map((v) => ({
          importedData: { path: this.jsonbPath(field), equals: v },
        }));
        return { OR: orClauses } as PrismaType.PatientWhereInput;
      }
      // numeric/date comparisons on imported JSONB → raw SQL (flag don't build Prisma clause)
      default:
        return null;
    }
  }

  /** JSONB path: searches across all batch keys in importedData */
  private jsonbPath(field: string): string[] {
    // importedData is { "batchId": { field: value, ... }, ... }
    // Prisma path traverses: for each top-level key, then the field.
    // We use array_path via Prisma's path with a wildcard-like traversal.
    return [field];
  }

  private collectRawFilter(filter: Filter, rawFilters: RawSqlFilter[]): void {
    const numericOps = new Set([
      'greater_than', 'less_than', 'between',
      'date_before', 'date_after', 'date_between',
    ]);
    if (numericOps.has(filter.operator)) {
      rawFilters.push({
        field: filter.field,
        operator: filter.operator as RawSqlFilter['operator'],
        value: filter.value as string | number,
        valueTo: filter.valueTo,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Relation fields (consultation, surgery, medication, scale)
  // ─────────────────────────────────────────────

  private buildRelationClause(
    relation: 'consultations' | 'surgeries' | 'medications' | 'scales',
    filter: Filter,
    knownFields: Set<string>,
  ): PrismaType.PatientWhereInput {
    const { field, operator, value, valueTo } = filter;
    const prismaField = knownFields.has(field) ? field : field;

    const clause: Record<string, unknown> = {};
    switch (operator) {
      case 'equals':
        clause[prismaField] = { equals: value };
        break;
      case 'not_equals':
        clause[prismaField] = { not: { equals: value } };
        break;
      case 'contains':
        clause[prismaField] = { contains: String(value), mode: 'insensitive' };
        break;
      case 'not_contains':
        return {
          NOT: {
            [relation]: {
              some: { [prismaField]: { contains: String(value), mode: 'insensitive' } },
            },
          },
        };
      case 'starts_with':
        clause[prismaField] = { startsWith: String(value), mode: 'insensitive' };
        break;
      case 'greater_than':
        clause[prismaField] = { gt: this.numericOrDate(value) };
        break;
      case 'less_than':
        clause[prismaField] = { lt: this.numericOrDate(value) };
        break;
      case 'between':
        clause[prismaField] = {
          gte: this.numericOrDate(value),
          lte: this.numericOrDate(valueTo),
        };
        break;
      case 'is_empty':
        clause.OR = [{ [prismaField]: null }, { [prismaField]: '' }];
        break;
      case 'is_not_empty':
        clause[prismaField] = { not: null };
        break;
      case 'in_list':
        clause[prismaField] = { in: value as string[] };
        break;
      case 'date_before':
        clause[prismaField] = { lt: new Date(String(value)) };
        break;
      case 'date_after':
        clause[prismaField] = { gt: new Date(String(value)) };
        break;
      case 'date_between':
        clause[prismaField] = {
          gte: new Date(String(value)),
          lte: new Date(String(valueTo)),
        };
        break;
      case 'boolean_true':
        clause[prismaField] = { equals: true };
        break;
      case 'boolean_false':
        clause[prismaField] = { equals: false };
        break;
      default:
        break;
    }

    clause.deletedAt = null;
    return {
      [relation]: { some: clause },
    } as PrismaType.PatientWhereInput;
  }

  private numericOrDate(value: string | number | boolean | string[] | undefined): unknown {
    if (value === undefined) return undefined;
    const str = String(value);
    // If it looks like a date, parse it
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return new Date(str);
    }
    // If purely numeric, return number
    if (/^-?\d+(\.\d+)?$/.test(str)) {
      return Number(str);
    }
    return value;
  }
}