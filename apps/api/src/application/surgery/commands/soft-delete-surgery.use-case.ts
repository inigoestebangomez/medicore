// apps/api/src/application/surgery/commands/soft-delete-surgery.use-case.ts
// BR-RBAC-001: PHYSICIAN ownership check — can only delete own surgeries

import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { MemberRole } from '@medicore/contracts';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { ForbiddenError } from './update-surgery.use-case';

export interface SoftDeleteSurgeryCommand {
  id: string;
  organizationId: string;
  role: MemberRole;
  userId: string;
}

export class SoftDeleteSurgeryUseCase {
  constructor(private readonly surgeryRepo: ISurgeryRepository) {}

  async execute(command: SoftDeleteSurgeryCommand) {
    const { id, organizationId, role, userId } = command;

    // Fetch existing surgery
    const existing = await this.surgeryRepo.findById(id, organizationId);
    if (!existing) {
      throw new SurgeryNotFoundError(id);
    }

    // BR-RBAC-001: PHYSICIAN ownership check
    if (role === 'PHYSICIAN' && existing.physicianId !== userId) {
      throw new ForbiddenError('PHYSICIAN can only delete their own surgeries');
    }

    return this.surgeryRepo.softDelete(id, organizationId);
  }
}