// apps/api/src/domain/medication/medication.repository.interface.ts
import type { Medication } from './medication.entity';
import type { MedicationStatus } from '@medicore/contracts';

export interface ListMedicationsParams {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  status?: MedicationStatus;
}

export interface CreateMedicationInput {
  organizationId: string;
  patientId: string;
  consultationId?: string | null;
  physicianId: string;
  drugName: string;
  drugCode?: string | null;
  activeIngredient?: string | null;
  dosage: string;
  frequency: string;
  route?: string | null;
  form?: string | null;
  startDate: Date;
  endDate?: Date | null;
  duration?: string | null;
  status?: MedicationStatus;
  instructions?: string | null;
  reason?: string | null;
  createdBy: string;
  auditLog?: any[];
}

export interface UpdateMedicationInput {
  status?: MedicationStatus;
  discontinuationReason?: string | null;
  updatedBy: string;
  auditLog?: any[];
}

export interface IMedicationRepository {
  findById(id: string, organizationId: string): Promise<Medication | null>;
  listByPatient(params: ListMedicationsParams): Promise<{ items: Medication[]; total: number }>;
  create(data: CreateMedicationInput): Promise<Medication>;
  update(id: string, organizationId: string, data: UpdateMedicationInput): Promise<Medication>;
  softDelete(id: string, organizationId: string): Promise<Medication>;
  findActiveByActiveIngredient(patientId: string, organizationId: string, activeIngredient: string): Promise<Medication[]>;
}