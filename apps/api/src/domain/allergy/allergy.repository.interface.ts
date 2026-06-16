// apps/api/src/domain/allergy/allergy.repository.interface.ts
import type { Allergy } from './allergy.entity';

export interface CreateAllergyInput {
  organizationId: string;
  patientId: string;
  substance: string;
  severity: string;
  status?: string;
  reaction?: string | null;
  substanceCode?: string | null;
  onsetDate?: Date | null;
  notes?: string | null;
  createdBy: string;
}

export interface UpdateAllergyInput {
  substance?: string;
  severity?: string;
  status?: string;
  reaction?: string | null;
  substanceCode?: string | null;
  onsetDate?: Date | null;
  notes?: string | null;
}

export interface IAllergyRepository {
  findByPatientId(patientId: string, organizationId: string): Promise<Allergy[]>;
  findById(id: string, organizationId: string): Promise<Allergy | null>;
  create(data: CreateAllergyInput): Promise<Allergy>;
  update(id: string, organizationId: string, data: UpdateAllergyInput): Promise<Allergy>;
  softDelete(id: string, organizationId: string): Promise<Allergy>;
}