// apps/api/src/application/consultation/commands/update-consultation.use-case.ts
// BR-RBAC-001: PHYSICIAN ownership check — can only update own consultations
// BR-CON-004: Audit trail — diff only changed fields
// BR-CON-006: Re-validate diagnosis/procedure codes if changed

import type { IConsultationRepository, UpdateConsultationInput } from '@/domain/consultation/consultation.repository.interface';
import type { DiagnosisCodeEntry, ProcedureCodeEntry, AuditLogEntry } from '@/domain/consultation/consultation.entity';
import type { MemberRole } from '@medicore/contracts';
import { ConsultationNotFoundError } from '@/domain/consultation/errors/consultation-not-found.error';
import { InvalidDiagnosisCodeError } from '@/domain/consultation/errors/invalid-diagnosis-code.error';
import { InvalidProcedureCodeError } from '@/domain/consultation/errors/invalid-procedure-code.error';
import { validateCode } from '@medicore/clinical-codes';

export class ForbiddenError extends Error {
  public readonly code = 'FORBIDDEN';
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface UpdateConsultationCommand {
  id: string;
  organizationId: string;
  role: MemberRole;
  userId: string;
  date?: Date;
  type?: string;
  chiefComplaint?: string;
  currentIllness?: string | null;
  physicalExam?: Record<string, unknown> | null;
  assessment?: string | null;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  plan?: string | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
}

export class UpdateConsultationUseCase {
  constructor(private readonly consultationRepo: IConsultationRepository) {}

  async execute(command: UpdateConsultationCommand) {
    const { id, organizationId, role, userId } = command;

    // Fetch existing consultation
    const existing = await this.consultationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ConsultationNotFoundError(id);
    }

    // BR-RBAC-001: PHYSICIAN ownership check
    if (role === 'PHYSICIAN' && existing.createdBy !== userId) {
      throw new ForbiddenError('PHYSICIAN can only update their own consultations');
    }
    // OWNER can update any consultation (no check needed)

    // BR-CON-006: Re-validate diagnosis codes if changed
    if (command.diagnosisCodes && command.diagnosisCodes.length > 0) {
      for (const dc of command.diagnosisCodes) {
        if (!validateCode(dc.system, dc.code)) {
          throw new InvalidDiagnosisCodeError(dc.code, `Code ${dc.code} not found in ${dc.system} catalog`);
        }
      }
    }

    // Validate procedure codes if changed
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

    // Build update data — only include provided fields
    const updateData: UpdateConsultationInput = {
      updatedBy: userId,
    };

    // Build audit log entry for changed fields
    const changedFields: string[] = [];

    if (command.date !== undefined) {
      updateData.date = command.date;
      changedFields.push('date');
    }
    if (command.type !== undefined) {
      updateData.type = command.type;
      changedFields.push('type');
    }
    if (command.chiefComplaint !== undefined) {
      updateData.chiefComplaint = command.chiefComplaint;
      changedFields.push('chiefComplaint');
    }
    if (command.currentIllness !== undefined) {
      updateData.currentIllness = command.currentIllness;
      changedFields.push('currentIllness');
    }
    if (command.physicalExam !== undefined) {
      updateData.physicalExam = command.physicalExam;
      changedFields.push('physicalExam');
    }
    if (command.assessment !== undefined) {
      updateData.assessment = command.assessment;
      changedFields.push('assessment');
    }
    if (command.diagnosisCodes !== undefined) {
      updateData.diagnosisCodes = command.diagnosisCodes as any;
      changedFields.push('diagnosisCodes');
    }
    if (command.plan !== undefined) {
      updateData.plan = command.plan;
      changedFields.push('plan');
    }
    if (command.procedureCodes !== undefined) {
      updateData.procedureCodes = command.procedureCodes as any;
      changedFields.push('procedureCodes');
    }
    if (command.followUpDate !== undefined) {
      updateData.followUpDate = command.followUpDate;
      changedFields.push('followUpDate');
    }
    if (command.followUpNotes !== undefined) {
      updateData.followUpNotes = command.followUpNotes;
      changedFields.push('followUpNotes');
    }

    // Attach audit log entry if any fields changed
    if (changedFields.length > 0) {
      const auditEntry: AuditLogEntry = {
        action: 'UPDATE',
        performedBy: userId,
        performedAt: new Date(),
        details: `Updated fields: ${changedFields.join(', ')}`,
      };
      updateData.auditLog = auditEntry;
    }

    return this.consultationRepo.update(id, organizationId, updateData);
  }
}
