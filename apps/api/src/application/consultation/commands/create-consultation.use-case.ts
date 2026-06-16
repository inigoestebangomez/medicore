// apps/api/src/application/consultation/commands/create-consultation.use-case.ts
// BR-CON-001: Patient must exist and be active (not soft-deleted)
// BR-CON-002: Date cannot be > 24h in the future
// BR-CON-003: FIRST_VISIT duplicate warning (soft — include firstVisitWarning in result, don't block)
// BR-CON-006: Validate diagnosis codes against clinical-codes catalog
// BR-CON-007: Max 1 primary, max 10 total (already validated by Zod, but double-check in use-case)

import type { IConsultationRepository, CreateConsultationInput } from '@/domain/consultation/consultation.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import type { DiagnosisCodeEntry, ProcedureCodeEntry } from '@/domain/consultation/consultation.entity';
import type { ConsultationType } from '@medicore/contracts';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';
import { InvalidDiagnosisCodeError } from '@/domain/consultation/errors/invalid-diagnosis-code.error';
import { InvalidProcedureCodeError } from '@/domain/consultation/errors/invalid-procedure-code.error';
import { validateCode } from '@medicore/clinical-codes';

export interface CreateConsultationCommand {
  organizationId: string;
  patientId: string;
  date: Date;
  type: ConsultationType;
  physicianId: string;
  chiefComplaint: string;
  currentIllness?: string | null;
  physicalExam?: Record<string, unknown> | null;
  assessment?: string | null;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  plan?: string | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
  createdBy: string;
  generateReport?: boolean;
}

export interface CreateConsultationResult {
  consultation: Consultation;
  firstVisitWarning: boolean;
  reportQueued?: boolean;
}

export class CreateConsultationUseCase {
  constructor(
    private readonly consultationRepo: IConsultationRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly reportQueue?: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {}

  async execute(command: CreateConsultationCommand): Promise<CreateConsultationResult> {
    // BR-CON-001: Patient must exist and be active
    const patient = await this.patientRepo.findById(command.patientId, command.organizationId);
    if (!patient) {
      throw new PatientNotActiveError(command.patientId);
    }

    // BR-CON-002: Date cannot be > 24h in the future
    const now = new Date();
    const maxFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (command.date > maxFuture) {
      throw new DateInFutureError(command.date.toISOString());
    }

    // BR-CON-006: Validate diagnosis codes against clinical-codes catalog
    if (command.diagnosisCodes && command.diagnosisCodes.length > 0) {
      for (const dc of command.diagnosisCodes) {
        if (!validateCode(dc.system, dc.code)) {
          throw new InvalidDiagnosisCodeError(dc.code, `Code ${dc.code} not found in ${dc.system} catalog`);
        }
      }
    }

    // BR-CON-007: Double-check max 1 primary, max 10 total
    if (command.diagnosisCodes && command.diagnosisCodes.length > 0) {
      const primaryCount = command.diagnosisCodes.filter((c) => c.type === 'primary').length;
      if (primaryCount > 1) {
        throw new InvalidDiagnosisCodeError('', 'Only one primary diagnosis allowed');
      }
      if (command.diagnosisCodes.length > 10) {
        throw new InvalidDiagnosisCodeError('', 'Maximum 10 diagnosis codes allowed');
      }
    }

    // Validate procedure codes against clinical-codes catalog
    // Only SNOMED procedure codes can be validated currently (catalog supports ICD10/SNOMED)
    if (command.procedureCodes && command.procedureCodes.length > 0) {
      const invalidCodes: string[] = [];
      for (const pc of command.procedureCodes) {
        if (pc.system === 'SNOMED') {
          if (!validateCode('SNOMED', pc.code)) {
            invalidCodes.push(pc.code);
          }
        }
        // ICD10PCS and CPT codes are not in the clinical-codes catalog yet
      }
      if (invalidCodes.length > 0) {
        throw new InvalidProcedureCodeError(invalidCodes);
      }
    }

    // BR-CON-003: FIRST_VISIT duplicate warning (soft)
    let firstVisitWarning = false;
    if (command.type === 'FIRST_VISIT') {
      const exists = await this.consultationRepo.existsFirstVisitForPatient(
        command.patientId,
        command.organizationId,
      );
      firstVisitWarning = exists;
    }

    // Create consultation
    const consultationData: CreateConsultationInput = {
      patientId: command.patientId,
      organizationId: command.organizationId,
      date: command.date,
      type: command.type,
      physicianId: command.physicianId,
      chiefComplaint: command.chiefComplaint,
      currentIllness: command.currentIllness ?? null,
      physicalExam: command.physicalExam ?? null,
      assessment: command.assessment ?? null,
      diagnosisCodes: command.diagnosisCodes ?? null,
      plan: command.plan ?? null,
      procedureCodes: command.procedureCodes ?? null,
      followUpDate: command.followUpDate ?? null,
      followUpNotes: command.followUpNotes ?? null,
      createdBy: command.createdBy,
    };

    const consultation = await this.consultationRepo.create(consultationData);

    // Enqueue BullMQ job if generateReport=true
    let reportQueued: boolean | undefined;
    if (command.generateReport && this.reportQueue) {
      await this.reportQueue.add('generate', {
        consultationId: consultation.id,
        patientId: consultation.patientId,
        organizationId: consultation.organizationId,
      });
      reportQueued = true;
    }

    return {
      consultation,
      firstVisitWarning,
      reportQueued,
    };
  }
}
