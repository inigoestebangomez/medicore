// apps/api/src/domain/scale/scale.repository.interface.ts
import type { ClinicalScale } from './clinical-scale.entity';
import type { ClinicalScaleType } from '@medicore/contracts';

export interface ListScalesParams {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  scaleType?: ClinicalScaleType;
  from?: Date;
  to?: Date;
}

export interface CreateClinicalScaleInput {
  organizationId: string;
  patientId: string;
  consultationId?: string | null;
  scaleType: ClinicalScaleType;
  date: Date;
  scores: Record<string, number>;
  total: number;
  notes?: string | null;
  auditLog?: any[];
  createdBy: string;
}

export interface UpdateClinicalScaleInput {
  scores?: Record<string, number>;
  total?: number;
  notes?: string | null;
  updatedBy: string;
  auditLog?: any[];
}

export interface IClinicalScaleRepository {
  findById(id: string, organizationId: string): Promise<ClinicalScale | null>;
  listByPatient(params: ListScalesParams): Promise<{ items: ClinicalScale[]; total: number }>;
  create(data: CreateClinicalScaleInput): Promise<ClinicalScale>;
  update(id: string, organizationId: string, data: UpdateClinicalScaleInput): Promise<ClinicalScale>;
  softDelete(id: string, organizationId: string): Promise<ClinicalScale>;
}