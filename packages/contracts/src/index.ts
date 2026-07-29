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
} from './surgery.schema';

// Imaging
export {
  ImagingStudyTypeSchema,
  CreateImagingStudySchema,
  UpdateImagingStudySchema,
  ListImagingStudiesQuerySchema,
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
  UploadFilesResponse,
  PresignedUrlResponse,
  PendingDeletionResponse,
} from './imaging.schema';

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
} from './billing.schema';

// Import (Phase 11)
export {
  ImportStatusSchema,
  IMPORT_ALLOWED_TRANSITIONS,
  StandardFieldSchema,
  ColumnMappingSchema,
  ColumnMappingProposalSchema,
  FileSampleSchema,
  ParsedFileSchema,
  MatchDecisionSchema,
  PatientMatchSchema,
  ConfirmMappingSchema,
  FinalizeImportSchema,
  ImportBatchSummarySchema,
  ImportBatchResponseSchema,
  ListImportBatchesQuerySchema,
  IMPORT_TIER_LIMITS,
  IMPORT_LIMIT_BYPASS_ENV,
} from './import.schema';

export type {
  ImportStatus,
  StandardField,
  ColumnMapping,
  ColumnMappingProposal,
  FileSample,
  ParsedFile,
  MatchDecision,
  PatientMatch,
  ConfirmMappingInput,
  FinalizeImportInput,
  ImportBatchSummary,
  ImportBatchResponse,
  ListImportBatchesQuery,
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
} from './research.schema';