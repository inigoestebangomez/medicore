// apps/api/src/domain/clinical-record/diagnosis/diagnosis.repository.interface.ts
import type { Diagnosis, DiagnosisCodeSystem, DiagnosisStatus } from './diagnosis.entity';

export interface CreateDiagnosisInput {
  organizationId: string;
  patientId: string;
  system: DiagnosisCodeSystem;
  code: string;
  description: string;
  catalogVersion: string;
  status: DiagnosisStatus;
  variables: Record<string, string | number | boolean>;
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
}

export interface IDiagnosisRepository {
  findByPatient(patientId: string, organizationId: string): Promise<Diagnosis[]>;
  findActiveByPatient(patientId: string, organizationId: string): Promise<Diagnosis[]>;
  findById(id: string, organizationId: string): Promise<Diagnosis | null>;
  create(data: CreateDiagnosisInput): Promise<Diagnosis>;
  updateStatus(
    id: string,
    organizationId: string,
    status: DiagnosisStatus,
    extra: { resolvedAt?: Date; discardedAt?: Date; discardedBy?: string },
  ): Promise<Diagnosis>;
}
