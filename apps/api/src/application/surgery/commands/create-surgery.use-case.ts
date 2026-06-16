// apps/api/src/application/surgery/commands/create-surgery.use-case.ts
// BR-SUR-001: Patient must exist and be active (not soft-deleted) — consent warning soft check
// BR-SUR-002: ASA classification required when status is COMPLETED
// BR-SUR-004: Date must be <= now when status is COMPLETED
// BR-VAL-PROC: Validate procedure codes against clinical-codes catalog

import type { ISurgeryRepository, CreateSurgeryInput } from '@/domain/surgery/surgery.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { Surgery } from '@/domain/surgery/surgery.entity';
import type { SurgeryStatus, AsaClassification } from '@medicore/contracts';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { AsaRequiredError } from '@/domain/surgery/errors/asa-required.error';
import { InvalidProcedureCodeError } from '@/domain/surgery/errors/invalid-procedure-code.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';
import { validateCode } from '@medicore/clinical-codes';

export interface CreateSurgeryCommand {
  organizationId: string;
  patientId: string;
  date: Date;
  procedureType: string;
  physicianId: string;
  status?: SurgeryStatus;
  asa?: AsaClassification | null;
  procedureCodes?: any[] | null;
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
  generateReport?: boolean;
}

export interface CreateSurgeryResult {
  surgery: Surgery;
  consentWarning: boolean;
  reportQueued?: boolean;
}

export class CreateSurgeryUseCase {
  constructor(
    private readonly surgeryRepo: ISurgeryRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly reportQueue?: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {}

  async execute(command: CreateSurgeryCommand): Promise<CreateSurgeryResult> {
    // BR-SUR-001: Patient must exist and be active
    const patient = await this.patientRepo.findById(command.patientId, command.organizationId);
    if (!patient) {
      throw new PatientNotActiveError(command.patientId);
    }

    // BR-SUR-001: Consent record check — soft warning, don't block
    // TODO: ConsentRecord doesn't exist yet — implement when available
    const consentWarning = false;

    // Validate procedureCodes against clinical-codes catalog
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

    // Default status to SCHEDULED if not provided
    const status: SurgeryStatus = command.status ?? 'SCHEDULED';

    // BR-SUR-002: ASA required when status is COMPLETED
    const asaValue = command.asa ?? null;
    if (status === 'COMPLETED' && !asaValue) {
      throw new AsaRequiredError();
    }

    // BR-SUR-004: Date must be <= now when status is COMPLETED
    if (status === 'COMPLETED' && command.date > new Date()) {
      throw new DateInFutureError(command.date.toISOString());
    }

    // Create surgery
    const surgeryData: CreateSurgeryInput = {
      organizationId: command.organizationId,
      patientId: command.patientId,
      date: command.date,
      status,
      physicianId: command.physicianId,
      procedureType: command.procedureType,
      procedureCodes: command.procedureCodes ?? null,
      asa: asaValue as string | null,
      anesthesiaType: command.anesthesiaType ?? null,
      preOpNotes: command.preOpNotes ?? null,
      preOpChecklist: command.preOpChecklist ?? null,
      duration: command.duration ?? null,
      technique: command.technique ?? null,
      findings: command.findings ?? null,
      complications: command.complications ?? null,
      postOpNotes: command.postOpNotes ?? null,
      postOpProtocol: command.postOpProtocol ?? null,
      outcome: command.outcome ?? null,
      createdBy: command.createdBy,
    };

    const surgery = await this.surgeryRepo.create(surgeryData);

    // Enqueue BullMQ job if generateReport=true
    let reportQueued: boolean | undefined;
    if (command.generateReport && this.reportQueue) {
      await this.reportQueue.add('generate', {
        surgeryId: surgery.id,
        patientId: surgery.patientId,
        organizationId: surgery.organizationId,
      });
      reportQueued = true;
    }

    return {
      surgery,
      consentWarning,
      reportQueued,
    };
  }
}