// apps/api/src/domain/clinical-record/current-illness/current-illness.repository.interface.ts
import type { CurrentIllnessEntry, DurationUnit } from './current-illness-entry.entity';

export interface CreateCurrentIllnessInput {
  organizationId: string;
  patientId: string;
  symptoms: string;
  durationValue?: number | null;
  durationUnit?: DurationUnit | null;
  onset?: Date | null;
  evolution?: string | null;
  narrative?: string | null;
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
  reviewState: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
}

export interface ICurrentIllnessRepository {
  findByPatient(patientId: string, organizationId: string): Promise<CurrentIllnessEntry[]>;
  findById(id: string, organizationId: string): Promise<CurrentIllnessEntry | null>;
  create(data: CreateCurrentIllnessInput): Promise<CurrentIllnessEntry>;
}
