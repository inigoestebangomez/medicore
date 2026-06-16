// apps/api/src/application/surgery/commands/update-surgery.use-case.ts
// BR-RBAC-001: PHYSICIAN ownership check — can only update own surgeries
// BR-SUR-005: Edit reason required when modifying terminal state (COMPLETED/CANCELLED)
// BR-VAL-PROC: Re-validate procedure codes if changed

import type { ISurgeryRepository, UpdateSurgeryInput } from '@/domain/surgery/surgery.repository.interface';
import type { MemberRole } from '@medicore/contracts';
import type { AuditLogEntry } from '@/domain/consultation/consultation.entity';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { EditReasonRequiredError } from '@/domain/surgery/errors/edit-reason-required.error';
import { InvalidProcedureCodeError } from '@/domain/surgery/errors/invalid-procedure-code.error';
import { validateCode } from '@medicore/clinical-codes';

export class ForbiddenError extends Error {
  public readonly code = 'FORBIDDEN';
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface UpdateSurgeryCommand {
  id: string;
  organizationId: string;
  role: MemberRole;
  userId: string;
  procedureType?: string;
  procedureCodes?: any[] | null;
  asa?: string | null;
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
  editReason?: string | null;
}

export class UpdateSurgeryUseCase {
  constructor(private readonly surgeryRepo: ISurgeryRepository) {}

  async execute(command: UpdateSurgeryCommand) {
    const { id, organizationId, role, userId } = command;

    // Fetch existing surgery
    const existing = await this.surgeryRepo.findById(id, organizationId);
    if (!existing) {
      throw new SurgeryNotFoundError(id);
    }

    // BR-RBAC-001: PHYSICIAN ownership check
    if (role === 'PHYSICIAN' && existing.physicianId !== userId) {
      throw new ForbiddenError('PHYSICIAN can only update their own surgeries');
    }
    // OWNER can update any surgery (no check needed)

    // BR-SUR-005: Edit reason required for terminal state edits
    if (existing.isTerminal() && !command.editReason) {
      throw new EditReasonRequiredError();
    }

    // Re-validate procedure codes if changed
    if (command.procedureCodes && command.procedureCodes.length > 0) {
      const invalidCodes: string[] = [];
      for (const pc of command.procedureCodes) {
        if (pc.system === 'SNOMED') {
          if (!validateCode('SNOMED', pc.code)) {
            invalidCodes.push(pc.code);
          }
        }
      }
      if (invalidCodes.length > 0) {
        throw new InvalidProcedureCodeError(invalidCodes);
      }
    }

    // Build update data — only include provided fields
    const updateData: UpdateSurgeryInput = {
      updatedBy: userId,
    };

    // Build audit log entry for changed fields
    const changedFields: string[] = [];

    if (command.procedureType !== undefined) {
      updateData.procedureType = command.procedureType;
      changedFields.push('procedureType');
    }
    if (command.procedureCodes !== undefined) {
      updateData.procedureCodes = command.procedureCodes;
      changedFields.push('procedureCodes');
    }
    if (command.asa !== undefined) {
      updateData.asa = command.asa;
      changedFields.push('asa');
    }
    if (command.anesthesiaType !== undefined) {
      updateData.anesthesiaType = command.anesthesiaType;
      changedFields.push('anesthesiaType');
    }
    if (command.preOpNotes !== undefined) {
      updateData.preOpNotes = command.preOpNotes;
      changedFields.push('preOpNotes');
    }
    if (command.preOpChecklist !== undefined) {
      updateData.preOpChecklist = command.preOpChecklist;
      changedFields.push('preOpChecklist');
    }
    if (command.duration !== undefined) {
      updateData.duration = command.duration;
      changedFields.push('duration');
    }
    if (command.technique !== undefined) {
      updateData.technique = command.technique;
      changedFields.push('technique');
    }
    if (command.findings !== undefined) {
      updateData.findings = command.findings;
      changedFields.push('findings');
    }
    if (command.complications !== undefined) {
      updateData.complications = command.complications;
      changedFields.push('complications');
    }
    if (command.postOpNotes !== undefined) {
      updateData.postOpNotes = command.postOpNotes;
      changedFields.push('postOpNotes');
    }
    if (command.postOpProtocol !== undefined) {
      updateData.postOpProtocol = command.postOpProtocol;
      changedFields.push('postOpProtocol');
    }
    if (command.outcome !== undefined) {
      updateData.outcome = command.outcome;
      changedFields.push('outcome');
    }
    if (command.editReason !== undefined) {
      updateData.editReason = command.editReason;
      changedFields.push('editReason');
    }

    // Attach audit log entry if any fields changed
    if (changedFields.length > 0) {
      const auditEntry: AuditLogEntry = {
        action: 'UPDATE',
        performedBy: userId,
        performedAt: new Date(),
        details: `Updated fields: ${changedFields.join(', ')}`,
      };
      updateData.auditLog = [auditEntry];
    }

    return this.surgeryRepo.update(id, organizationId, updateData);
  }
}