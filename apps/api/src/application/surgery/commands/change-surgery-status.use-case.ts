// apps/api/src/application/surgery/commands/change-surgery-status.use-case.ts
// BR-SUR-003: State transition validation — only allowed transitions
// BR-SUR-002: ASA classification required when transitioning to COMPLETED
// BR-SUR-004: Date must be <= now when transitioning to COMPLETED
// BR-RBAC-001: PHYSICIAN ownership check

import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { MemberRole, SurgeryStatus, AsaClassification } from '@medicore/contracts';
import type { AuditLogEntry } from '@/domain/consultation/consultation.entity';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { InvalidSurgeryTransitionError } from '@/domain/surgery/errors/invalid-surgery-transition.error';
import { AsaRequiredError } from '@/domain/surgery/errors/asa-required.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';
import { ForbiddenError } from './update-surgery.use-case';

export interface ChangeSurgeryStatusCommand {
  id: string;
  organizationId: string;
  patientId: string;
  role: MemberRole;
  userId: string;
  targetStatus: SurgeryStatus;
  asa?: AsaClassification;
  date?: Date;
  statusReason?: string;
}

export class ChangeSurgeryStatusUseCase {
  constructor(private readonly surgeryRepo: ISurgeryRepository) {}

  async execute(command: ChangeSurgeryStatusCommand) {
    const { id, organizationId, role, userId, targetStatus } = command;

    // Fetch surgery
    const existing = await this.surgeryRepo.findById(id, organizationId);
    if (!existing) {
      throw new SurgeryNotFoundError(id);
    }

    // BR-RBAC-001: PHYSICIAN ownership check
    if (role === 'PHYSICIAN' && existing.physicianId !== userId) {
      throw new ForbiddenError('PHYSICIAN can only change status of their own surgeries');
    }

    // BR-SUR-003: Validate transition
    if (!existing.canTransitionTo(targetStatus)) {
      throw new InvalidSurgeryTransitionError(existing.status, targetStatus);
    }

    // BR-SUR-002: If transitioning to COMPLETED, ASA is required
    if (targetStatus === 'COMPLETED') {
      const asaValue = command.asa ?? existing.asa;
      if (!asaValue) {
        throw new AsaRequiredError();
      }

      // BR-SUR-004: Date must be <= now
      const dateValue = command.date ?? existing.date;
      if (dateValue > new Date()) {
        throw new DateInFutureError(dateValue.toISOString());
      }
    }

    // Transition
    const transitioned = existing.transitionTo(
      targetStatus,
      command.date,
      command.asa as AsaClassification | undefined,
      command.statusReason,
    );

    // Build audit log entry
    const auditEntry: AuditLogEntry = {
      action: 'STATUS_CHANGE',
      performedBy: userId,
      performedAt: new Date(),
      details: `Status changed from ${existing.status} to ${targetStatus}${command.statusReason ? `: ${command.statusReason}` : ''}`,
    };

    // Update via repository
    const updated = await this.surgeryRepo.update(id, organizationId, {
      status: targetStatus,
      asa: transitioned.asa as string | null,
      editReason: command.statusReason ?? null,
      updatedBy: userId,
      auditLog: [auditEntry],
    });

    return updated;
  }
}