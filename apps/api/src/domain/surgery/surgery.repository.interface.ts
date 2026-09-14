// apps/api/src/domain/surgery/surgery.repository.interface.ts
import type { Surgery } from './surgery.entity';
import type { SurgeryStatus } from '@medicore/contracts';

export interface ListSurgeriesParams {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  status?: SurgeryStatus;
  from?: Date;
  to?: Date;
}

export interface ListOrgSurgeriesParams {
  organizationId: string;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  status?: SurgeryStatus;
  physicianId?: string;
  from?: Date;
  to?: Date;
}

export interface PatientNameLite {
  firstName: string;
  lastName: string;
}

export interface ListOrgSurgeriesResult {
  items: Surgery[];
  total: number;
  patientNames: Map<string, PatientNameLite>;
}

export interface CreateSurgeryInput {
  organizationId: string;
  patientId: string;
  date: Date;
  status: SurgeryStatus;
  physicianId: string;
  procedureType: string;
  procedureCodes?: any[] | null;
  asa?: string | null;
  anesthesiaType?: string | null;
  preOpNotes?: string | null;
  preOpChecklist?: Record<string, unknown> | null;
  duration?: number | null;
  technique?: Record<string, unknown> | null;
  findings?: string | null;
  complications?: string | null;
  postOpNotes?: string | null;
  postOpProtocol?: Record<string, unknown> | null;
  outcome?: string | null;
  createdBy: string;
  auditLog?: any[];
}

export interface UpdateSurgeryInput {
  status?: SurgeryStatus;
  date?: Date;
  procedureType?: string;
  procedureCodes?: any[] | null;
  asa?: string | null;
  anesthesiaType?: string | null;
  preOpNotes?: string | null;
  preOpChecklist?: Record<string, unknown> | null;
  duration?: number | null;
  technique?: Record<string, unknown> | null;
  findings?: string | null;
  complications?: string | null;
  postOpNotes?: string | null;
  postOpProtocol?: Record<string, unknown> | null;
  outcome?: string | null;
  editReason?: string | null;
  updatedBy: string;
  auditLog?: any[];
}

export interface ISurgeryRepository {
  findById(id: string, organizationId: string): Promise<Surgery | null>;
  findByPatientId(id: string, patientId: string, organizationId: string): Promise<Surgery | null>;
  listByPatient(params: ListSurgeriesParams): Promise<{ items: Surgery[]; total: number }>;
  listByOrganization(params: ListOrgSurgeriesParams): Promise<ListOrgSurgeriesResult>;
  create(data: CreateSurgeryInput): Promise<Surgery>;
  update(id: string, organizationId: string, data: UpdateSurgeryInput): Promise<Surgery>;
  softDelete(id: string, organizationId: string): Promise<Surgery>;
  hasScheduledSurgeries(patientId: string, organizationId: string): Promise<boolean>;
  /** Import-only provenance lookup. Optional keeps patient-only test doubles valid. */
  findByImportBatchRow?(batchId: string, organizationId: string, rowIndex: number): Promise<Surgery | null>;
  /** Soft-delete only records materialized by the given import batch. */
  removeImportedBatch?(batchId: string, organizationId: string): Promise<number>;
}
