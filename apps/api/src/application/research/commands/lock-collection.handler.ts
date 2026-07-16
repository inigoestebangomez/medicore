// apps/api/src/application/research/commands/lock-collection.handler.ts
// Command handler: LockCollection.
// Publishes a collection — BR-RES-003: once locked it is immutable (no member
// additions or removals). Idempotent: locking an already-locked collection is
// a no-op success.

import { Injectable, Inject } from '@nestjs/common';
import type { IPatientCollectionRepository } from '@/domain/research/patient-collection.repository.interface';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';

export interface LockCollectionCommand {
  collectionId: string;
  organizationId: string;
  lockedBy: string;
}

export interface LockCollectionResult {
  collectionId: string;
  isLocked: boolean;
  patientCount: number;
  lockedAt: string;
}

@Injectable()
export class LockCollectionHandler {
  constructor(
    @Inject('IPatientCollectionRepository')
    private readonly collectionRepo: IPatientCollectionRepository,
  ) {}

  async execute(cmd: LockCollectionCommand): Promise<LockCollectionResult> {
    const existing = await this.collectionRepo.findById(
      cmd.collectionId,
      cmd.organizationId,
    );
    if (!existing) throw new CollectionNotFoundError(cmd.collectionId);

    void cmd.lockedBy;

    if (!existing.isLocked) {
      const locked = await this.collectionRepo.lock(
        cmd.collectionId,
        cmd.organizationId,
      );
      return {
        collectionId: locked.id,
        isLocked: locked.isLocked,
        patientCount: locked.patientCount,
        lockedAt: locked.updatedAt.toISOString(),
      };
    }

    // Already locked — idempotent.
    return {
      collectionId: existing.id,
      isLocked: existing.isLocked,
      patientCount: existing.patientCount,
      lockedAt: existing.updatedAt.toISOString(),
    };
  }
}