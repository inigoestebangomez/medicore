// apps/api/src/application/consultation/commands/soft-delete-consultation.use-case.ts
// BR-RBAC-001: PHYSICIAN ownership check — can only delete own consultations

import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { MemberRole } from '@medicore/contracts';
import { ConsultationNotFoundError } from '@/domain/consultation/errors/consultation-not-found.error';
import { ForbiddenError } from './update-consultation.use-case';

export interface SoftDeleteConsultationCommand {
  id: string;
  organizationId: string;
  role: MemberRole;
  userId: string;
}

export class SoftDeleteConsultationUseCase {
  constructor(private readonly consultationRepo: IConsultationRepository) {}

  async execute(command: SoftDeleteConsultationCommand) {
    const { id, organizationId, role, userId } = command;

    // Fetch existing consultation
    const existing = await this.consultationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ConsultationNotFoundError(id);
    }

    // BR-RBAC-001: PHYSICIAN ownership check
    if (role === 'PHYSICIAN' && existing.createdBy !== userId) {
      throw new ForbiddenError('PHYSICIAN can only delete their own consultations');
    }

    return this.consultationRepo.softDelete(id, organizationId);
  }
}
