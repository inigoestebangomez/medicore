// apps/api/src/application/imaging/commands/soft-delete-imaging-study.use-case.ts
// BR-IMG-005: Soft delete → PendingDeletion records → deferred R2 deletion
// BR-IMG-008: Queue deferred deletion job for each file

import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { IPendingDeletionRepository, CreatePendingDeletionInput } from '@/domain/imaging/pending-deletion.repository.interface';
import type { MemberRole } from '@medicore/contracts';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import { StudyAlreadyDeletedError } from '@/domain/imaging/errors/study-already-deleted.error';

export interface SoftDeleteImagingStudyCommand {
  id: string;
  organizationId: string;
  role: MemberRole;
  userId: string;
}

const RETENTION_PERIOD_MS = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years

export class SoftDeleteImagingStudyUseCase {
  constructor(
    private readonly imagingRepo: IImagingStudyRepository,
    private readonly pendingDeletionRepo: IPendingDeletionRepository,
    private readonly deletionQueue?: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {}

  async execute(command: SoftDeleteImagingStudyCommand): Promise<ImagingStudy> {
    const { id, organizationId } = command;

    // Fetch existing study
    const existing = await this.imagingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ImagingStudyNotFoundError(id);
    }

    // Check if already deleted
    if (existing.deletedAt) {
      throw new StudyAlreadyDeletedError(id);
    }

    // Soft delete the study
    const deleted = await this.imagingRepo.softDelete(id, organizationId);

    // BR-IMG-005: Create PendingDeletion records for each file
    const scheduledAt = new Date(Date.now() + RETENTION_PERIOD_MS);

    for (const file of existing.files) {
      const pendingData: CreatePendingDeletionInput = {
        organizationId: existing.organizationId,
        entityType: 'ImagingStudy',
        entityId: existing.id,
        fileKey: file.key,
        scheduledAt,
      };
      await this.pendingDeletionRepo.create(pendingData);
    }

    // BR-IMG-008: Enqueue delayed BullMQ job for deferred deletion processing
    if (this.deletionQueue) {
      await this.deletionQueue.add('process-pending-deletions', {
        organizationId: existing.organizationId,
      });
    }

    return deleted;
  }
}