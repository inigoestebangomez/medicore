// @medicore/contracts — Zod schemas and TypeScript contracts
// Barrel export

// Auth
export {
  MemberRoleSchema,
  JwtPayloadSchema,
  UserProfileSchema,
  SwitchOrganizationSchema,
  AuthProfileSchema,
  MembershipSchema,
} from './auth.schema';

export type {
  MemberRole,
  JwtPayload,
  UserProfile,
  SwitchOrganizationInput,
  AuthProfile,
  Membership,
} from './auth.schema';

// Organization
export {
  OrganizationTypeSchema,
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  OrganizationSchema,
} from './organization.schema';

export type {
  OrganizationType,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationResponse,
} from './organization.schema';

// Member
export {
  InviteMemberSchema,
  UpdateMemberRoleSchema,
} from './member.schema';

export type {
  InviteMemberInput,
  UpdateMemberRoleInput,
} from './member.schema';

// Invitation
export {
  AcceptInvitationSchema,
  InvitationResponseSchema,
} from './invitation.schema';

export type {
  AcceptInvitationInput,
  InvitationResponse,
} from './invitation.schema';

// Patient
export {
  SexSchema,
  IdDocumentTypeSchema,
  BloodTypeSchema,
  PaginationSchema,
  CreatePatientSchema,
  UpdatePatientSchema,
  PatientResponseSchema,
  SearchPatientsSchema,
} from './patient.schema';

export type {
  Sex,
  IdDocumentType,
  BloodType,
  CreatePatientInput,
  UpdatePatientInput,
  PatientResponse,
  SearchPatientsInput,
} from './patient.schema';

// Allergy
export {
  AllergySeveritySchema,
  AllergyStatusSchema,
  CreateAllergySchema,
  UpdateAllergySchema,
  AllergyResponseSchema,
} from './allergy.schema';

export type {
  AllergySeverity,
  AllergyStatus,
  CreateAllergyInput,
  UpdateAllergyInput,
  AllergyResponse,
} from './allergy.schema';

// Consultation
export {
  ConsultationTypeSchema,
  DiagnosisCodeSchema,
  DiagnosisCodesArraySchema,
  ProcedureCodeSchema,
  CreateConsultationSchema,
  UpdateConsultationSchema,
  ConsultationResponseSchema,
  ListConsultationsQuerySchema,
  ConsultationListItemSchema,
  SearchConsultationLogsSchema,
} from './consultation.schema';

export type {
  ConsultationType,
  DiagnosisCode,
  ProcedureCode,
  CreateConsultationInput,
  UpdateConsultationInput,
  ConsultationResponse,
  ListConsultationsQuery,
  ConsultationListItem,
  SearchConsultationLogs,
} from './consultation.schema';

// Form Schema
export {
  FormFieldSchema,
  FormTemplateSchema,
  FormValueSchema,
  FormInstanceSchema,
} from './form-schema.schema';

export type {
  FormField,
  FormTemplate,
  FormValue,
  FormInstance,
} from './form-schema.schema';

// Surgery
export {
  SurgeryStatusSchema,
  AsaClassificationSchema,
  CreateSurgerySchema,
  UpdateSurgerySchema,
  ChangeSurgeryStatusSchema,
  SurgeryResponseSchema,
  ListSurgeriesQuerySchema,
  ListOrgSurgeriesQuerySchema,
  OrgSurgeryListItemSchema,
  ALLOWED_TRANSITIONS,
} from './surgery.schema';

export type {
  SurgeryStatus,
  AsaClassification,
  CreateSurgeryInput,
  UpdateSurgeryInput,
  ChangeSurgeryStatusInput,
  SurgeryResponse,
  ListSurgeriesQuery,
  ListOrgSurgeriesQuery,
  OrgSurgeryListItem,
} from './surgery.schema';

// Imaging
export {
  ImagingStudyTypeSchema,
  CreateImagingStudySchema,
  UpdateImagingStudySchema,
  ListImagingStudiesQuerySchema,
  ListOrgImagingStudiesQuerySchema,
  OrgImagingStudyListItemSchema,
  FileMetadataSchema,
  UploadFilesResponseSchema,
  PresignedUrlResponseSchema,
  PendingDeletionSchema,
} from './imaging.schema';

export type {
  ImagingStudyType,
  CreateImagingStudyInput,
  UpdateImagingStudyInput,
  ListImagingStudiesQuery,
  ListOrgImagingStudiesQuery,
  OrgImagingStudyListItem,
  UploadFilesResponse,
  PresignedUrlResponse,
  PendingDeletionResponse,
} from './imaging.schema';

// Calendar
export {
  CalendarEventSourceSchema,
  CalendarEventStatusSchema,
  CalendarProviderSchema,
  CalendarEventViewSchema,
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  ListCalendarEventsQuerySchema,
  CalendarEventResponseSchema,
  CalendarSyncProviderSchema,
  ProviderConnectionStatusSchema,
  ListSyncProvidersResponseSchema,
  ConnectProviderResponseSchema,
  CallbackProviderRequestSchema,
  CallbackProviderResponseSchema,
  DisconnectProviderResponseSchema,
  SyncRefreshResponseSchema,
} from './calendar.schema';

export type {
  CalendarEventSource,
  CalendarEventStatus,
  CalendarProvider,
  CalendarEventView,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  ListCalendarEventsQuery,
  CalendarEventResponse,
  CalendarSyncProvider,
  ProviderConnectionStatus,
  ListSyncProvidersResponse,
  ConnectProviderResponse,
  CallbackProviderRequest,
  CallbackProviderResponse,
  DisconnectProviderResponse,
  SyncRefreshResponse,
} from './calendar.schema';

// Medication
export {
  MedicationStatusSchema,
  CreatePrescriptionSchema,
  DiscontinuePrescriptionSchema,
  ListMedicationsQuerySchema,
  MedicationResponseSchema,
  MEDICATION_ALLOWED_TRANSITIONS,
} from './medication.schema';

export type {
  MedicationStatus,
  CreatePrescriptionInput,
  DiscontinuePrescriptionInput,
  ListMedicationsQuery,
  MedicationResponse,
} from './medication.schema';

// Clinical Scale
export {
  ClinicalScaleTypeSchema,
  CreateScaleSchema,
  UpdateScaleSchema,
  ListScalesQuerySchema,
  ScaleResponseSchema,
  Snot22ScoresSchema,
  VasTinnitusScoresSchema,
  DhiScoresSchema,
  VhiScoresSchema,
  RsiScoresSchema,
  OsaEpworthScoresSchema,
  StopbangScoresSchema,
  NoseScoresSchema,
  CustomScoresSchema,
  ScaleTypeValidationMap,
} from './scale.schema';

export type {
  ClinicalScaleType,
  CreateScaleInput,
  UpdateScaleInput,
  ListScalesQuery,
  ScaleResponse,
} from './scale.schema';

// Billing
export {
  PlanTypeSchema,
  BillingIntervalSchema,
  CreateCheckoutSchema,
  CreatePortalSchema,
  UsageResponseSchema,
  CheckoutResponseSchema,
  PortalResponseSchema,
  StripeWebhookEventSchema,
  BillingTransactionTypeSchema,
  BillingTransactionStatusSchema,
  UpdateBillingTransactionSchema,
} from './billing.schema';

export type {
  PlanType as BillingPlanType,
  BillingInterval,
  CreateCheckoutInput,
  CreatePortalInput,
  UsageResponse,
  CheckoutResponse,
  PortalResponse,
  StripeWebhookEvent,
  UpdateBillingTransactionInput,
} from './billing.schema';

// Import (Phase 11)
export {
  ImportedClinicalEventSchema,
  ImportedEventsPageSchema,
  ImportStatusSchema,
  IMPORT_ALLOWED_TRANSITIONS,
  StandardFieldSchema,
  ColumnMappingSchema,
  ColumnMappingConflictSchema,
  formatColumnMappingConflict,
  validateColumnMapping,
  ColumnMappingProposalSchema,
  FileSampleSchema,
  ParsedFileSchema,
  MatchDecisionSchema,
  MatchResolutionSchema,
  PatientMatchSchema,
  IgnoredColumnSchema,
  IgnoredRowSchema,
  IgnoredRowsSchema,
  PreviewOverridesSchema,
  CellOverridesSchema,
  RowClassificationSchema,
  ConfirmMappingSchema,
  FinalizeImportSchema,
  ConfirmImportResponseSchema,
  ImportBatchSummarySchema,
  ImportBatchResponseSchema,
  ImportBatchHistoryItemSchema,
  ImportHistoryResponseSchema,
  ListImportBatchesQuerySchema,
  ImportPreviewRowSchema,
  ImportPreviewResponseSchema,
  IMPORT_TIER_LIMITS,
  IMPORT_LIMIT_BYPASS_ENV,
} from './import.schema';

export type {
  ImportedClinicalEvent,
  ImportedEventsPage,
  ImportStatus,
  StandardField,
  ColumnMapping,
  ColumnMappingConflict,
  ColumnMappingValidationResult,
  ColumnMappingProposal,
  FileSample,
  ParsedFile,
  MatchDecision,
  MatchResolution,
  PatientMatch,
  IgnoredColumn,
  IgnoredRow,
  PreviewOverrides,
  CellOverrides,
  RowClassification,
  ConfirmMappingInput,
  FinalizeImportInput,
  ConfirmImportResponse,
  ImportBatchSummary,
  ImportBatchResponse,
  ImportBatchHistoryItem,
  ImportHistoryResponse,
  ListImportBatchesQuery,
  ImportPreviewRow,
  ImportPreviewResponse,
} from './import.schema';

// Research (Phase 12)
export {
  FieldSourceSchema,
  FilterOperatorSchema,
  FilterSchema,
  FilterValueSchema,
  FilterLogicSchema,
  DataSourceSchema,
  VisualizationTypeSchema,
  ResearchQueryInputSchema,
  ResearchQueryResponseSchema,
  PatientCollectionInputSchema,
  PatientCollectionResponseSchema,
  AddToCollectionInputSchema,
  QueryResultRowSchema,
  FieldStatsSchema,
  CategoryDistributionSchema,
  ExecuteQueryResponseSchema,
  ExportFormatSchema,
  ExportRequestSchema,
  ListResearchQueriesQuerySchema,
  // Research Engine V2
  WidgetChartTypeSchema,
  WidgetPositionSchema,
  WidgetDisplayConfigSchema,
  DashboardWidgetSchema,
  DashboardLayoutSchema,
  DashboardInputSchema,
  DashboardResponseSchema,
  AddWidgetInputSchema,
  FieldTypeSchema,
  FieldSourceV2Schema,
  FieldCatalogEntrySchema,
  FieldCatalogResponseSchema,
  SharePermissionSchema,
  SharingSchema,
  ShareInputSchema,
  ExecuteAdHocQueryInputSchema,
  PaginatedResultsSchema,
  InferentialTestTypeSchema,
  EffectSizeSchema,
  AssumptionWarningSchema,
  StatisticalTestResultSchema,
  InferentialRequestSchema,
  CrossTabCellSchema,
  CrossTabResultSchema,
  CrossTabRequestSchema,
  TimeSeriesPeriodSchema,
  TimeSeriesPointSchema,
  TimeSeriesResultSchema,
  TimeSeriesRequestSchema,
  SurvivalCurvePointSchema,
  SurvivalResultSchema,
  ExportV2StyleSchema,
  ExportV2RequestSchema,
  ExportV2ResponseSchema,
  // Guided Statistical Analysis (V5)
  GuidedAnalysisPathSchema,
  GuidedExposureSchema,
  GuidedPairedSchema,
  CorrectionMethodSchema,
  GuidedAnalysisRequestSchema,
  EffectMeasureSchema,
  RelativeRiskResultSchema,
  PAdjustResultSchema,
  GuidedCorrectionSchema,
  GuidedDescriptiveSummarySchema,
  GuidedInferentialResultSchema,
  GuidedCohortContextSchema,
  GuidedAnalysisResultSchema,
  GuidedExportRequestSchema,
} from './research.schema';

export type {
  FieldSource,
  FilterOperator,
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
  ResearchQueryInput,
  ResearchQueryResponse,
  PatientCollectionInput,
  PatientCollectionResponse,
  AddToCollectionInput,
  QueryResultRow,
  FieldStats,
  CategoryDistribution,
  ExecuteQueryResponse,
  ExportFormat,
  ExportRequest,
  ListResearchQueriesQuery,
  // Research Engine V2
  WidgetChartType,
  WidgetPosition,
  WidgetDisplayConfig,
  DashboardWidget,
  DashboardLayout,
  DashboardInput,
  DashboardResponse,
  AddWidgetInput,
  FieldType,
  FieldSourceV2,
  FieldCatalogEntry,
  FieldCatalogResponse,
  SharePermission,
  Sharing,
  ShareInput,
  ExecuteAdHocQueryInput,
  PaginatedResults,
  InferentialTestType,
  EffectSize,
  AssumptionWarning,
  StatisticalTestResult,
  InferentialRequest,
  CrossTabCell,
  CrossTabResult,
  CrossTabRequest,
  TimeSeriesPeriod,
  TimeSeriesPoint,
  TimeSeriesResult,
  TimeSeriesRequest,
  SurvivalCurvePoint,
  SurvivalResult,
  ExportV2Style,
  ExportV2Request,
  ExportV2Response,
  // Guided Statistical Analysis (V5)
  GuidedAnalysisPath,
  GuidedExposure,
  GuidedPaired,
  CorrectionMethod,
  GuidedAnalysisRequest,
  EffectMeasure,
  RelativeRiskResult,
  PAdjustResult,
  GuidedCorrection,
  GuidedDescriptiveSummary,
  GuidedInferentialResult,
  GuidedCohortContext,
  GuidedAnalysisResult,
  GuidedExportRequest,
} from './research.schema';

// Research Engine V4 — Form Builder (REQ-FB-001..013)
export {
  StudyTypeSchema,
  VariableTypeSchema,
  VariableScopeSchema,
  AnalysisTestSchema,
  RiskFactorLabelSchema,
  VariableOptionSchema,
  VariableRangeSchema,
  StudyVariableInputSchema,
  StudyVariableUpdateSchema,
  StudyVariableResponseSchema,
  ReorderVariablesInputSchema,
  ChildSpecSchema,
  DecomposeInputSchema,
  VariableTemplateInputSchema,
  VariableTemplateResponseSchema,
  AddFromTemplateInputSchema,
  StudySubjectInputSchema,
  StudySubjectResponseSchema,
  StudySubjectUpdateSchema,
  AutoFillPreviewInputSchema,
  AutoFillPreviewSchema,
  UpdateAutoFillMapInputSchema,
  RunAnalysisInputSchema,
  StatisticalAnalysisResponseSchema,
  RegistrationFormResponseSchema,
  KappaInputSchema,
  IccInputSchema,
  CronbachInputSchema,
} from './research-form.schema';

export type {
  StudyType,
  VariableType,
  VariableScope,
  AnalysisTest,
  RiskFactorLabel,
  VariableOption,
  VariableRange,
  StudyVariableInput,
  StudyVariableUpdate,
  StudyVariableResponse,
  ReorderVariablesInput,
  ChildSpec,
  DecomposeInput,
  VariableTemplateInput,
  VariableTemplateResponse,
  AddFromTemplateInput,
  StudySubjectInput,
  StudySubjectResponse,
  StudySubjectUpdate,
  AutoFillPreviewInput,
  AutoFillPreview,
  UpdateAutoFillMapInput,
  RunAnalysisInput,
  StatisticalAnalysisResponse,
  RegistrationFormResponse,
  KappaInput,
  IccInput,
  CronbachInput,
} from './research-form.schema';

// Clinical Record (Seven Categories)
export {
  ClinicalRecordCategorySchema,
  ReviewStateSchema,
  ProvenanceSchema,
  AgeReferenceDateSchema,
  HistoryEntryTypeSchema,
  CreateHistoryEntrySchema,
  HistoryEntryResponseSchema,
  DurationUnitSchema,
  CreateCurrentIllnessSchema,
  CurrentIllnessResponseSchema,
  ExamTemplateFieldSchema,
  PhysicalExamTemplateSchema,
  CustomFindingSchema,
  CreatePhysicalExamRecordSchema,
  PhysicalExamRecordResponseSchema,
  CreateLabReportSchema,
  LabResultItemSchema,
  LabReportResponseSchema,
  ConfirmLabResultsSchema,
  DiagnosisCodeSystemSchema,
  DiagnosisStatusSchema,
  CreateDiagnosisSchema,
  DiagnosisResponseSchema,
  UpdateDiagnosisStatusSchema,
  DicomMetadataSchema,
  ClinicalRecordResponseSchema,
} from './clinical-record.schema';

export type {
  ClinicalRecordCategory,
  ReviewState,
  Provenance,
  AgeReferenceDate,
  HistoryEntryType,
  CreateHistoryEntryInput,
  HistoryEntryResponse,
  DurationUnit,
  CreateCurrentIllnessInput,
  CurrentIllnessResponse,
  ExamTemplateField,
  PhysicalExamTemplateResponse,
  CustomFinding,
  CreatePhysicalExamRecordInput,
  PhysicalExamRecordResponse,
  CreateLabReportInput,
  LabResultItem,
  LabReportResponse,
  ConfirmLabResultsInput,
  DiagnosisCodeSystem,
  DiagnosisStatus,
  CreateDiagnosisInput,
  DiagnosisResponse,
  UpdateDiagnosisStatusInput,
  DicomMetadata,
  ClinicalRecordResponse as ClinicalRecordResponseType,
} from './clinical-record.schema';
