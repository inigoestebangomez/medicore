// apps/api/src/domain/consultation/consultation.repository.interface.ts
import type { Consultation } from './consultation.entity';
import type { AuditLogEntry } from './consultation.entity';
import type { ConsultationType } from '@medicore/contracts';

export interface ListConsultationsParams {
  organizationId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  type?: ConsultationType;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface SearchLogsParams {
  patientId: string;
  organizationId: string;
  query: string;
  field?: string;
  fromDate?: Date;
  toDate?: Date;
  page: number;
  pageSize: number;
}

export interface CreateConsultationInput {
  patientId: string;
  organizationId: string;
  date: Date;
  type: string;
  chiefComplaint: string;
  currentIllness?: string | null;
  physicalExam?: Record<string, unknown> | null;
  assessment?: string | null;
  diagnosisCodes?: Array<{
    system: string;
    code: string;
    description: string;
    type: string;
    notes?: string;
  }> | null;
  plan?: string | null;
  procedureCodes?: Array<{
    system: string;
    code: string;
    description: string;
    laterality?: string;
    notes?: string;
  }> | null;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
  physicianId: string;
  createdBy: string;
}

export interface UpdateConsultationInput {
  date?: Date;
  type?: string;
  chiefComplaint?: string;
  currentIllness?: string | null;
  physicalExam?: Record<string, unknown> | null;
  assessment?: string | null;
  diagnosisCodes?: Array<{
    system: string;
    code: string;
    description: string;
    type: string;
    notes?: string;
  }> | null;
  plan?: string | null;
  procedureCodes?: Array<{
    system: string;
    code: string;
    description: string;
    laterality?: string;
    notes?: string;
  }> | null;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
  updatedBy: string;
  auditLog?: AuditLogEntry;
}

export interface IConsultationRepository {
  findById(id: string, organizationId: string): Promise<Consultation | null>;
  findByPatientId(patientId: string, organizationId: string): Promise<Consultation[]>;
  listByPatient(patientId: string, organizationId: string, params: ListConsultationsParams): Promise<{ items: Consultation[]; total: number }>;
  searchLogs(params: SearchLogsParams): Promise<{ items: Consultation[]; total: number }>;
  create(data: CreateConsultationInput): Promise<Consultation>;
  update(id: string, organizationId: string, data: UpdateConsultationInput): Promise<Consultation>;
  softDelete(id: string, organizationId: string): Promise<Consultation>;
  existsFirstVisitForPatient(patientId: string, organizationId: string): Promise<boolean>;
}