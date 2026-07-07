// apps/api/src/infrastructure/queues/pending-deletions.processor.ts
// BR-IMG-005: Deferred physical deletion of R2 files
// Processes PendingDeletion records whose scheduledAt has passed.
// Deletes files from R2, then marks records as processed.

import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { IStorageService } from '@/domain/shared/storage.interface';
import type { IPendingDeletionRepository } from '@/domain/imaging/pending-deletion.repository.interface';

interface PendingDeletionJobData {
  organizationId: string;
}

@Injectable()
@Processor('pending-deletions')
export class PendingDeletionsProcessor {
  constructor(
    @Inject('IStorageService') private readonly storageService: IStorageService,
    @Inject('IPendingDeletionRepository') private readonly pendingDeletionRepo: IPendingDeletionRepository,
  ) {}

  @Process('process-pending-deletions')
  async handlePendingDeletions(_job: Job<PendingDeletionJobData>): Promise<void> {
    const now = new Date();
    const dueRecords = await this.pendingDeletionRepo.findDue(now);

    for (const record of dueRecords) {
      try {
        // Delete file from R2
        await this.storageService.delete(record.fileKey);

        // Mark record as processed
        await this.pendingDeletionRepo.markProcessed(record.id);
      } catch (error: any) {
        console.error(
          `[PendingDeletionsProcessor] Failed to delete file ${record.fileKey} for entity ${record.entityId}:`,
          error?.message ?? error,
        );
        // Don't mark as processed — will be retried on next sweep
      }
    }
  }
}