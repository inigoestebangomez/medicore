// apps/api/src/application/research/commands/add-to-collection.handler.ts
// Command handler: AddToCollection.
// Adds patients to an existing unlocked collection. BR-RES-003: a locked
// collection rejects all writes — the repository throws CollectionLockedError,
// which the API layer maps to 403.

import { Injectable, Inject } from '@nestjs/common';
import type { IPatientCollectionRepository } from '@/domain/research/patient-collection.repository.interface';

export interface AddToCollectionCommand {
  collectionId: string;
  organizationId: string;
  addedBy: string;
  patientIds: string[];
  notes?: string;
}

export interface AddToCollectionResult {
  collectionId: string;
  patientCount: number;
  addedCount: number;
}

@Injectable()
export class AddToCollectionHandler {
  constructor(
    @Inject('IPatientCollectionRepository')
    private readonly collectionRepo: IPatientCollectionRepository,
  ) {}

  async execute(cmd: AddToCollectionCommand): Promise<AddToCollectionResult> {
    const before = await this.collectionRepo.findById(
      cmd.collectionId,
      cmd.organizationId,
    );
    if (!before) {
      return { collectionId: cmd.collectionId, patientCount: 0, addedCount: 0 };
    }
    const beforeCount = before.patientCount;

    // Repository enforces BR-RES-003: locked → CollectionLockedError.
    const updated = await this.collectionRepo.addMembers(
      cmd.collectionId,
      cmd.organizationId,
      cmd.patientIds,
      cmd.addedBy,
      cmd.notes,
    );

    return {
      collectionId: updated.id,
      patientCount: updated.patientCount,
      addedCount: Math.max(0, updated.patientCount - beforeCount),
    };
  }
}