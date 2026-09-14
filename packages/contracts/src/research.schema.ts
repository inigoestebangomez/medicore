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

// ─────────────────────────────────────────────
// RESEARCH ENGINE V2 — Dashboard + Widget (design AD-2)
// Definition order matters: DashboardWidget references ResearchQuery by ID.
// ─────────────────────────────────────────────

/** Chart types a widget can render (design: live-reference) */
export const WidgetChartTypeSchema = z.enum([
  'bar_chart',
  'line_chart',
  'scatter',
  'stats',
  'kaplan_meier',
  'cross_tab',
]);
export type WidgetChartType = z.infer<typeof WidgetChartTypeSchema>;

/** Widget grid position (reactable layout grid) */
export const WidgetPositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
});
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;

/** Display config embedded per-widget: which fields, which breakdown */
export const WidgetDisplayConfigSchema = z.object({
  displayFields: z.array(z.string()).default([]),
  groupBy: z.string().optional(),
  /** Extra stats request for stats widgets */
  statsMode: z.enum(['descriptive', 'inferential']).default('descriptive'),
}).catchall(z.unknown());
export type WidgetDisplayConfig = z.infer<typeof WidgetDisplayConfigSchema>;

export const DashboardWidgetSchema = z.object({
  id: z.string().uuid(),
  queryId: z.string().uuid(),
  chartType: WidgetChartTypeSchema,
  position: WidgetPositionSchema,
  displayConfig: WidgetDisplayConfigSchema.default({}),
  title: z.string().optional(),
});
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;

export const DashboardLayoutSchema = z
  .object({
    /** Compact density: "comfortable" | "compact" */
    density: z.enum(['comfortable', 'compact']).default('comfortable'),
    background: z.string().optional(),
  })
  .catchall(z.unknown())
  .default({});
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;

export const DashboardInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  widgets: z.array(DashboardWidgetSchema).default([]),
  layout: DashboardLayoutSchema,
});
export type DashboardInput = z.infer<typeof DashboardInputSchema>;

export const DashboardResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  widgets: z.array(DashboardWidgetSchema).default([]),
  layout: DashboardLayoutSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

export const AddWidgetInputSchema = DashboardWidgetSchema;
export type AddWidgetInput = z.infer<typeof AddWidgetInputSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Field Discovery (spec §5)
// ─────────────────────────────────────────────

export const FieldTypeSchema = z.enum(['string', 'number', 'date', 'boolean']);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const FieldSourceV2Schema = z.enum(['standard', 'imported']);
export type FieldSourceV2 = z.infer<typeof FieldSourceV2Schema>;

export const FieldCatalogEntrySchema = z.object({
  field: z.string().min(1),
  source: FieldSourceV2Schema,
  type: FieldTypeSchema,
  /** Count of non-null values observed across the org */
  nonNullCount: z.number().int().min(0),
  examples: z.array(z.unknown()).max(5).default([]),
  /** Physician-facing label. Optional for backwards-compatible catalog responses. */
  label: z.string().optional(),
  /** Unit only when it is explicit or safely inferred from the header. */
  unit: z.string().nullable().optional(),
  originalHeaders: z.array(z.string()).optional(),
  batches: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      originalFormat: z.string(),
      importedAt: z.string().datetime(),
    }),
  ).optional(),
  totalCount: z.number().int().min(0).optional(),
  completenessPercent: z.number().min(0).max(100).optional(),
});
export type FieldCatalogEntry = z.infer<typeof FieldCatalogEntrySchema>;

export const FieldCatalogResponseSchema = z.object({
  query: z.string().default(''),
  type: FieldTypeSchema.optional(),
  entries: z.array(FieldCatalogEntrySchema).default([]),
  totalPatients: z.number().int().min(0).optional(),
});
export type FieldCatalogResponse = z.infer<typeof FieldCatalogResponseSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Sharing (spec §7, BR-RES-001)
// ─────────────────────────────────────────────

export const SharePermissionSchema = z.enum(['view', 'edit']);
export type SharePermission = z.infer<typeof SharePermissionSchema>;

export const SharingSchema = z.object({
  users: z.array(z.string().uuid()).default([]),
  permission: SharePermissionSchema.default('view'),
});
export type Sharing = z.infer<typeof SharingSchema>;

export const ShareInputSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  permission: SharePermissionSchema.default('view'),
});
export type ShareInput = z.infer<typeof ShareInputSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Ad-hoc execution + cursor pagination (spec §8)
// ─────────────────────────────────────────────

export const ExecuteAdHocQueryInputSchema = z.object({
  filters: z.array(FilterSchema).default([]),
  filterLogic: FilterLogicSchema,
  dataSource: DataSourceSchema.default('all_patients'),
  importBatchIds: z.array(z.string().uuid()).default([]),
  displayFields: z.array(z.string()).default([]),
  statsMode: z.enum(['descriptive', 'inferential']).default('descriptive'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ExecuteAdHocQueryInput = z.infer<typeof ExecuteAdHocQueryInputSchema>;

export const PaginatedResultsSchema = z.object({
  items: z.array(QueryResultRowSchema).default([]),
  totalRows: z.number().int(),
  nextCursor: z.string().nullable(),
});
export type PaginatedResults = z.infer<typeof PaginatedResultsSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Statistical inference (spec §1, BR-RES-005)
// Python microservice contract. Mirrored to Pydantic by codegen.
// ─────────────────────────────────────────────

export const InferentialTestTypeSchema = z.enum([
  'ttest_independent',
  'ttest_paired',
  'mannwhitney',
  'kruskalwallis',
  'anova_oneway',
  'chi_square',
  'fisher_exact',
  'pearson',
  'spearman',
  'linear_regression',
  'logistic_regression',
  'kaplan_meier',
]);
export type InferentialTestType = z.infer<typeof InferentialTestTypeSchema>;

export const EffectSizeSchema = z
  .object({
    name: z.string(), // "cohen_d" | "odds_ratio" | "hazard_ratio" | "r"
    value: z.number().nullable(),
    ci95Lower: z.number().nullable(),
    ci95Upper: z.number().nullable(),
  })
  .nullable();
export type EffectSize = z.infer<typeof EffectSizeSchema>;

export const AssumptionWarningSchema = z.object({
  code: z.string(), // "normality_violated" | "variance_heterogeneous"
  message: z.string(),
  suggestion: z.string().optional(),
});
export type AssumptionWarning = z.infer<typeof AssumptionWarningSchema>;

export const StatisticalTestResultSchema = z.object({
  test: InferentialTestTypeSchema,
  statistic: z.number().nullable(),
  pValue: z.number().nullable(),
  ci95Lower: z.number().nullable(),
  ci95Upper: z.number().nullable(),
  effectSize: EffectSizeSchema,
  degreesFreedom: z.number().nullable(),
  assumptionsChecked: z.array(z.string()).default([]),
  warnings: z.array(AssumptionWarningSchema).default([]),
});
export type StatisticalTestResult = z.infer<typeof StatisticalTestResultSchema>;

export const InferentialRequestSchema = z.object({
  test: InferentialTestTypeSchema,
  data: z.object({
    group1: z.array(z.number()).default([]),
    group2: z.array(z.number()).default([]),
    paired: z.boolean().default(false),
  }).catchall(z.unknown()),
  alpha: z.number().default(0.05),
});
export type InferentialRequest = z.infer<typeof InferentialRequestSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Cross-tabulation (spec §2, BR-RES-004)
// ─────────────────────────────────────────────

export const CrossTabCellSchema = z.object({
  count: z.number().int(),
  suppressed: z.boolean().default(false), // BR-RES-004
});
export type CrossTabCell = z.infer<typeof CrossTabCellSchema>;

export const CrossTabResultSchema = z.object({
  rowField: z.string(),
  colField: z.string(),
  rows: z.array(z.string()),
  cols: z.array(z.string()),
  cells: z.array(z.array(CrossTabCellSchema)),
  rowTotals: z.array(z.number().int()),
  colTotals: z.array(z.number().int()),
  grandTotal: z.number().int(),
  chiSquare: z.number().nullable(),
  chiSquareP: z.number().nullable(),
  fisherExactP: z.number().nullable(),
  oddsRatio: z.number().nullable(),
  oddsRatioCi95: z.tuple([z.number(), z.number()]).nullable(),
  warnings: z.array(z.string()).default([]),
});
export type CrossTabResult = z.infer<typeof CrossTabResultSchema>;

export const CrossTabRequestSchema = z.object({
  rowField: z.string(),
  colField: z.string(),
  queryId: z.string().uuid().optional(),
});
export type CrossTabRequest = z.infer<typeof CrossTabRequestSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Time-series (spec §3)
// ─────────────────────────────────────────────

export const TimeSeriesPeriodSchema = z.enum(['month', 'quarter', 'year']);
export type TimeSeriesPeriod = z.infer<typeof TimeSeriesPeriodSchema>;

export const TimeSeriesPointSchema = z.object({
  period: z.string(),
  count: z.number().int(),
});
export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>;

export const TimeSeriesResultSchema = z.object({
  metric: z.string(),
  period: TimeSeriesPeriodSchema,
  points: z.array(TimeSeriesPointSchema),
  trendSlope: z.number().nullable(),
});
export type TimeSeriesResult = z.infer<typeof TimeSeriesResultSchema>;

export const TimeSeriesRequestSchema = z.object({
  queryId: z.string().uuid().optional(),
  metric: z.string(), // "consultations" | "surgeries" | imported event field
  period: TimeSeriesPeriodSchema.default('month'),
  dateField: z.string().optional(),
});
export type TimeSeriesRequest = z.infer<typeof TimeSeriesRequestSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Survival (spec §1 Kaplan-Meier)
// ─────────────────────────────────────────────

export const SurvivalCurvePointSchema = z.object({
  time: z.number(),
  survival: z.number(),
  ciLower: z.number().nullable(),
  ciUpper: z.number().nullable(),
  nAtRisk: z.number().int(),
  nEvents: z.number().int(),
});
export type SurvivalCurvePoint = z.infer<typeof SurvivalCurvePointSchema>;

export const SurvivalResultSchema = z.object({
  timePoints: z.array(z.number()),
  survival: z.array(z.number()),
  ciLower: z.array(z.number()),
  ciUpper: z.array(z.number()),
  riskTable: z.array(SurvivalCurvePointSchema),
  logRankP: z.number().nullable(),
  medianSurvival: z.number().nullable(),
  warnings: z.array(z.string()).default([]),
});
export type SurvivalResult = z.infer<typeof SurvivalResultSchema>;

// ─────────────────────────────────────────────
// RESEARCH V2 — Export V2 (spec §6, BR-RES-002)
// ─────────────────────────────────────────────

export const ExportV2StyleSchema = z.enum(['apa', 'vancouver']);
export type ExportV2Style = z.infer<typeof ExportV2StyleSchema>;

export const ExportV2RequestSchema = z.object({
  queryId: z.string().uuid().optional(),
  dashboardId: z.string().uuid().optional(),
  includeFigures: z.boolean().default(true),
  includeCrossTabs: z.boolean().default(true),
  style: ExportV2StyleSchema.default('apa'),
});
export type ExportV2Request = z.infer<typeof ExportV2RequestSchema>;

export const ExportV2ResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
});
export type ExportV2Response = z.infer<typeof ExportV2ResponseSchema>;

// ─────────────────────────────────────────────
// RESEARCH V5 — Guided Statistical Analysis (spec §guided)
// Two-path wizard: descriptive (Path 1) and inferential (Path 2).
// Replaces raw test selection with automatic test choice + rationale.
// ─────────────────────────────────────────────

export const GuidedAnalysisPathSchema = z.enum(['descriptive', 'inferential']);
export type GuidedAnalysisPath = z.infer<typeof GuidedAnalysisPathSchema>;

export const GuidedExposureSchema = z.object({
  domain: z.string().min(1), // "diagnosis" | "treatment" | "surgery" | "procedure"
  elementIds: z.array(z.string().min(1)).min(2), // ≥2 valid elements required
});
export type GuidedExposure = z.infer<typeof GuidedExposureSchema>;

export const GuidedPairedSchema = z.object({
  pre: z.string().min(1),
  post: z.string().min(1),
});
export type GuidedPaired = z.infer<typeof GuidedPairedSchema>;

export const CorrectionMethodSchema = z.enum(['holm', 'fdr']);
export type CorrectionMethod = z.infer<typeof CorrectionMethodSchema>;

export const GuidedAnalysisRequestSchema = z.object({
  queryId: z.string().uuid().optional(),
  path: GuidedAnalysisPathSchema,
  variables: z.array(z.string().min(1)).default([]),
  exposure: GuidedExposureSchema.optional(),
  outcome: z.string().min(1).optional(),
  paired: GuidedPairedSchema.optional(),
  correction: CorrectionMethodSchema.optional(),
  alpha: z.number().min(0.001).max(0.1).default(0.05),
});
export type GuidedAnalysisRequest = z.infer<typeof GuidedAnalysisRequestSchema>;

// Effect measures — RR and OR with CI (no continuity correction)
export const EffectMeasureSchema = z.object({
  name: z.enum(['relative_risk', 'odds_ratio']),
  value: z.number().nullable(), // null when suppressed (zero/unsafe cells)
  ci95Lower: z.number().nullable(),
  ci95Upper: z.number().nullable(),
  suppressed: z.boolean().default(false),
  suppressReason: z.string().optional(),
});
export type EffectMeasure = z.infer<typeof EffectMeasureSchema>;

// Relative risk result from Python service
export const RelativeRiskResultSchema = z.object({
  relativeRisk: z.number().nullable(),
  ci95Lower: z.number().nullable(),
  ci95Upper: z.number().nullable(),
  oddsRatio: z.number().nullable(),
  orCi95Lower: z.number().nullable(),
  orCi95Upper: z.number().nullable(),
  exposedCases: z.number().int(),
  exposedNonCases: z.number().int(),
  unexposedCases: z.number().int(),
  unexposedNonCases: z.number().int(),
  suppressed: z.boolean().default(false),
  suppressReason: z.string().optional(),
  warnings: z.array(AssumptionWarningSchema).default([]),
});
export type RelativeRiskResult = z.infer<typeof RelativeRiskResultSchema>;

// P-value adjustment result
export const PAdjustResultSchema = z.object({
  method: CorrectionMethodSchema,
  originalP: z.array(z.number()),
  adjustedP: z.array(z.number()),
  n: z.number().int(),
});
export type PAdjustResult = z.infer<typeof PAdjustResultSchema>;

// Correction entry in the guided result
export const GuidedCorrectionSchema = z.object({
  method: CorrectionMethodSchema,
  adjustedP: z.number().nullable(),
  originalP: z.number().nullable(),
  label: z.string().optional(),
});
export type GuidedCorrection = z.infer<typeof GuidedCorrectionSchema>;

// Descriptive summary per variable
export const GuidedDescriptiveSummarySchema = z.object({
  variable: z.string(),
  kind: z.enum(['quantitative', 'qualitative']),
  n: z.number().int(),
  missing: z.number().int().default(0),
  // Quantitative: mean, sd, median, q1, q3, min, max
  mean: z.number().nullable(),
  sd: z.number().nullable(),
  median: z.number().nullable(),
  q1: z.number().nullable(),
  q3: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  // Qualitative: category counts + percentages
  categories: z.array(z.object({
    label: z.string(),
    count: z.number().int(),
    percent: z.number(),
  })).default([]),
  suppressed: z.boolean().default(false),
  suppressReason: z.string().optional(),
});
export type GuidedDescriptiveSummary = z.infer<typeof GuidedDescriptiveSummarySchema>;

// Inferential result entry
export const GuidedInferentialResultSchema = z.object({
  variable: z.string().optional(),
  test: z.string(),
  statistic: z.number().nullable(),
  pValue: z.number().nullable(),
  effectMeasures: z.array(EffectMeasureSchema).default([]),
  groups: z.array(z.object({
    key: z.string(),
    n: z.number().int(),
  })).default([]),
  rationale: z.string().optional(),
  warnings: z.array(AssumptionWarningSchema).default([]),
});
export type GuidedInferentialResult = z.infer<typeof GuidedInferentialResultSchema>;

// Cohort context returned with every guided result
export const GuidedCohortContextSchema = z.object({
  queryId: z.string().uuid(),
  n: z.number().int(),
  filters: z.array(FilterSchema).default([]),
});
export type GuidedCohortContext = z.infer<typeof GuidedCohortContextSchema>;

// Main guided analysis result
export const GuidedAnalysisResultSchema = z.object({
  runId: z.string().uuid(),
  cohort: GuidedCohortContextSchema,
  path: GuidedAnalysisPathSchema,
  summaries: z.array(GuidedDescriptiveSummarySchema).default([]),
  results: z.array(GuidedInferentialResultSchema).default([]),
  rationale: z.array(z.string()).default([]),
  corrections: z.array(GuidedCorrectionSchema).default([]),
  warnings: z.array(AssumptionWarningSchema).default([]),
});
export type GuidedAnalysisResult = z.infer<typeof GuidedAnalysisResultSchema>;

// Guided export request (extends V3 with guided-specific payload)
export const GuidedExportRequestSchema = z.object({
  runId: z.string().uuid(),
  formats: z.array(z.enum(['pdf', 'docx', 'text', 'zip'])).min(1),
});
export type GuidedExportRequest = z.infer<typeof GuidedExportRequestSchema>;
