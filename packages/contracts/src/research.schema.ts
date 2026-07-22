// packages/contracts/src/research.schema.ts
// Zod schemas for the Research Engine (Phase 12).
// Mirrors Prisma ResearchQuery/PatientCollection models + UI filter contracts.

import { z } from 'zod';

// ─────────────────────────────────────────────
// Filter model (spec §8-9)
// ─────────────────────────────────────────────

export const FieldSourceSchema = z.enum([
  'standard',
  'imported',
  'consultation',
  'surgery',
  'medication',
  'scale',
]);
export type FieldSource = z.infer<typeof FieldSourceSchema>;

export const FilterOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'greater_than',
  'less_than',
  'between',
  'is_empty',
  'is_not_empty',
  'in_list',
  'date_before',
  'date_after',
  'date_between',
  'boolean_true',
  'boolean_false',
]);
export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const FilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const FilterSchema = z.object({
  field: z.string().min(1),
  source: FieldSourceSchema,
  operator: FilterOperatorSchema,
  value: FilterValueSchema.optional(),
  valueTo: z.union([z.string(), z.number()]).optional(), // for "between" / "date_between"
});
export type Filter = z.infer<typeof FilterSchema>;

export const FilterLogicSchema = z.enum(['AND', 'OR']).default('AND');
export type FilterLogic = z.infer<typeof FilterLogicSchema>;

// ─────────────────────────────────────────────
// Data source (spec §8)
// ─────────────────────────────────────────────

export const DataSourceSchema = z.enum([
  'all_patients',
  'import_batch',
  'manual_only',
  'imported_only',
]);
export type DataSource = z.infer<typeof DataSourceSchema>;

// ─────────────────────────────────────────────
// Visualization types (spec §10)
// ─────────────────────────────────────────────

export const VisualizationTypeSchema = z.enum([
  'table',
  'bar_chart',
  'line_chart',
  'scatter',
  'stats',
]);
export type VisualizationType = z.infer<typeof VisualizationTypeSchema>;

// ─────────────────────────────────────────────
// ResearchQuery — saved query (spec §11 / Prisma model)
// ─────────────────────────────────────────────

export const ResearchQueryInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dataSource: DataSourceSchema.default('all_patients'),
  importBatchIds: z.array(z.string().uuid()).default([]),
  filters: z.array(FilterSchema).default([]),
  filterLogic: FilterLogicSchema,
  displayFields: z.array(z.string()).default([]),
  visualizations: z.array(VisualizationTypeSchema).default(['table', 'stats']),
  sharedWith: z.array(z.string().uuid()).default([]),
});
export type ResearchQueryInput = z.infer<typeof ResearchQueryInputSchema>;

export const ResearchQueryResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  dataSource: DataSourceSchema,
  importBatchIds: z.array(z.string()).default([]),
  filters: z.array(FilterSchema).default([]),
  filterLogic: FilterLogicSchema,
  displayFields: z.array(z.string()).default([]),
  visualizations: z.array(VisualizationTypeSchema).default([]),
  sharedWith: z.array(z.string()).default([]),
  lastRunAt: z.string().datetime().nullable(),
  lastRunCount: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ResearchQueryResponse = z.infer<typeof ResearchQueryResponseSchema>;

// ─────────────────────────────────────────────
// PatientCollection (spec §11 / Prisma model)
// ─────────────────────────────────────────────

export const PatientCollectionInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  queryId: z.string().uuid().optional(),
});
export type PatientCollectionInput = z.infer<typeof PatientCollectionInputSchema>;

export const PatientCollectionResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  queryId: z.string().uuid().nullable(),
  isLocked: z.boolean(),
  patientCount: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PatientCollectionResponse = z.infer<
  typeof PatientCollectionResponseSchema
>;

export const AddToCollectionInputSchema = z.object({
  patientIds: z.array(z.string().uuid()).min(1),
  notes: z.string().optional(),
});
export type AddToCollectionInput = z.infer<typeof AddToCollectionInputSchema>;

// ─────────────────────────────────────────────
// Execute query — response (spec §8-10)
// ─────────────────────────────────────────────

export const QueryResultRowSchema = z.object({
  patientId: z.string().uuid(),
  nhc: z.string(),
  // Dynamic display fields keyed by field name
  fields: z.record(z.string(), z.unknown()),
});
export type QueryResultRow = z.infer<typeof QueryResultRowSchema>;

export const FieldStatsSchema = z.object({
  field: z.string(),
  n: z.number().int(),
  mean: z.number().nullable(),
  median: z.number().nullable(),
  stdDev: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  ci95Lower: z.number().nullable(),
  ci95Upper: z.number().nullable(),
});
export type FieldStats = z.infer<typeof FieldStatsSchema>;

export const CategoryDistributionSchema = z.object({
  field: z.string(),
  // BR-RES-004: categories with N<5 are dropped
  categories: z.array(
    z.object({
      label: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type CategoryDistribution = z.infer<typeof CategoryDistributionSchema>;

export const ExecuteQueryResponseSchema = z.object({
  queryId: z.string().uuid(),
  totalRows: z.number().int(),
  rows: z.array(QueryResultRowSchema),
  stats: z.array(FieldStatsSchema).default([]),
  distributions: z.array(CategoryDistributionSchema).default([]),
  displayFields: z.array(z.string()).default([]),
  appliedFilters: z.array(FilterSchema).default([]),
});
export type ExecuteQueryResponse = z.infer<typeof ExecuteQueryResponseSchema>;

// ─────────────────────────────────────────────
// Export (spec §11, BR-RES-002)
// ─────────────────────────────────────────────

export const ExportFormatSchema = z.enum(['csv', 'word_table1', 'png_charts', 'stats_pdf']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportRequestSchema = z.object({
  format: ExportFormatSchema,
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;

// ─────────────────────────────────────────────
// Query history (spec §11)
// ─────────────────────────────────────────────

export const ListResearchQueriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListResearchQueriesQuery = z.infer<
  typeof ListResearchQueriesQuerySchema
>;