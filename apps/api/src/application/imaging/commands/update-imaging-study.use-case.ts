// apps/api/src/application/imaging/commands/update-imaging-study.use-case.ts
// BR-IMG-009: Update metadata only — findings, labels, description, links
// BR-RBAC-001: PHYSICIAN ownership check — PHYSICIAN can only update own studies

import type { IImagingStudyRepository, UpdateImagingStudyInput } from '@/domain/imaging/imaging-study.repository.interface';
import type { MemberRole } from '@medicore/contracts';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import { assertValidImagingStudyId } from '@/domain/imaging/imaging-study-id';

export class ForbiddenError extends Error {
  public readonly code = 'FORBIDDEN';
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface UpdateImagingStudyCommand {
  id: string;
  organizationId: string;
  role: MemberRole;
  userId: string;
  type?: string;
  date?: Date;
  description?: string | null;
  findings?: string | null;
  labels?: any[] | null;
  surgeryId?: string | null;
  consultationId?: string | null;
}

export class UpdateImagingStudyUseCase {
  constructor(private readonly imagingRepo: IImagingStudyRepository) {}

  async execute(command: UpdateImagingStudyCommand): Promise<ImagingStudy> {
    const { id, organizationId, role, userId } = command;
    assertValidImagingStudyId(id);

    // Fetch existing study
    const existing = await this.imagingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ImagingStudyNotFoundError(id);
    }

    // BR-RBAC-001: PHYSICIAN ownership check — PHYSICIAN can only update own studies
    if (role === 'PHYSICIAN' && existing.createdBy !== userId) {
      throw new ForbiddenError('PHYSICIAN can only update their own imaging studies');
    }
    // OWNER can update any study (no check needed)

    // Build update data — only include provided fields
    const updateData: UpdateImagingStudyInput = {
      updatedBy: userId,
    };

    if (command.type !== undefined) {
      updateData.type = command.type as any;
    }
    if (command.date !== undefined) {
      updateData.date = command.date;
    }
    if (command.description !== undefined) {
      updateData.description = command.description ?? null;
    }
    if (command.findings !== undefined) {
      updateData.findings = command.findings ?? null;
    }
    if (command.labels !== undefined) {
      updateData.labels = command.labels ?? null;
    }
    if (command.surgeryId !== undefined) {
      updateData.surgeryId = command.surgeryId ?? null;
    }
    if (command.consultationId !== undefined) {
      updateData.consultationId = command.consultationId ?? null;
    }

    return this.imagingRepo.update(id, organizationId, updateData);
  }
}
