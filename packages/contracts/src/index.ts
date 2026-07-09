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