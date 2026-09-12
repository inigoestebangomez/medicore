// apps/api/src/application/clinical-record/queries/get-clinical-record.use-case.ts
// Use-case: Category read-model query (spec §7 categories).
// Projects events + structured tables into a category-shaped response.
// Design: additive projection over existing Patient, Consultation, Surgery, etc.

import type { ClinicalRecordCategory } from '@medicore/contracts';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { IHistoryRepository } from '@/domain/clinical-record/history/history.repository.interface';
import type { ICurrentIllnessRepository } from '@/domain/clinical-record/current-illness/current-illness.repository.interface';
import type { IPhysicalExamRepository } from '@/domain/clinical-record/physical-exam/physical-exam.repository.interface';
import type { ILabReportRepository } from '@/domain/clinical-record/lab/lab-report.repository.interface';
import type { IDiagnosisRepository } from '@/domain/clinical-record/diagnosis/diagnosis.repository.interface';

export interface GetClinicalRecordQuery {
  organizationId: string;
  patientId: string;
  category: ClinicalRecordCategory;
}

export interface ClinicalRecordResult {
  patientId: string;
  category: ClinicalRecordCategory;
  data: unknown[];
  totalCount: number;
}

export class GetClinicalRecordUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly historyRepo: IHistoryRepository,
    private readonly illnessRepo: ICurrentIllnessRepository,
    private readonly examRepo: IPhysicalExamRepository,
    private readonly labRepo: ILabReportRepository,
    private readonly diagnosisRepo: IDiagnosisRepository,
  ) {}

  async execute(query: GetClinicalRecordQuery): Promise<ClinicalRecordResult> {
    const { organizationId, patientId, category } = query;

    // Verify patient exists and belongs to this org (tenant isolation)
    const patient = await this.patientRepo.findById(patientId, organizationId);
    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    switch (category) {
      case 'patient-data':
        return {
          patientId,
          category,
          data: [
            {
              ...patient,
              ageInfo: patient.ageWithFallback(),
            },
          ],
          totalCount: 1,
        };

      case 'history': {
        const entries = await this.historyRepo.findByPatient(patientId, organizationId);
        return { patientId, category, data: entries, totalCount: entries.length };
      }

      case 'current-illness': {
        const entries = await this.illnessRepo.findByPatient(patientId, organizationId);
        return { patientId, category, data: entries, totalCount: entries.length };
      }

      case 'physical-exam': {
        const records = await this.examRepo.findRecordsByPatient(patientId, organizationId);
        return { patientId, category, data: records, totalCount: records.length };
      }

      case 'complementary-tests': {
        const reports = await this.labRepo.findByPatient(patientId, organizationId);
        return { patientId, category, data: reports, totalCount: reports.length };
      }

      case 'diagnosis': {
        const diagnoses = await this.diagnosisRepo.findByPatient(patientId, organizationId);
        return { patientId, category, data: diagnoses, totalCount: diagnoses.length };
      }

      case 'treatment':
        // Treatment is a projection over surgeries + medications + follow-up.
        // For now, return an empty array — Phase 3 will wire the full projection.
        return { patientId, category, data: [], totalCount: 0 };

      default:
        throw new Error(`Unknown category: ${category}`);
    }
  }
}

export class PatientNotFoundError extends Error {
  constructor(public readonly patientId: string) {
    super(`Patient not found: ${patientId}`);
    this.name = 'PatientNotFoundError';
  }
}
