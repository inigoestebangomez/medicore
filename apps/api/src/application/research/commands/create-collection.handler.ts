// apps/api/src/application/research/commands/create-collection.handler.ts
// Command handler: CreateCollection.
// Creates a PatientCollection either from an explicit list of patient IDs or
// by executing a saved query and snapshooting its result set (spec §11).
// Collections start unlocked; BR-RES-003 immutability applies only after lock().

import { randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import type { IPatientCollectionRepository } from '@/domain/research/patient-collection.repository.interface';
import { PatientCollection } from '@/domain/research/patient-collection.entity';
import { ExecuteResearchQueryHandler } from '../queries/execute-research-query.handler';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';

export interface CreateCollectionCommand {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  /** Origin query — optional. */
  queryId?: string;
  /**
   * Explicit patient IDs. If omitted and a queryId is given, the handler
   * executes that query and snapshots its result row IDs. Required if no
   * queryId is given.
   */
  patientIds?: string[];
}

export interface CreateCollectionResult {
  id: string;
  name: string;
  queryId: string | null;
  patientCount: number;
  isLocked: boolean;
  createdAt: string;
}

@Injectable()
export class CreateCollectionHandler {
  constructor(
    @Inject('IPatientCollectionRepository')
    private readonly collectionRepo: IPatientCollectionRepository,
    private readonly executeQueryHandler: ExecuteResearchQueryHandler,
  ) {}

  async execute(cmd: CreateCollectionCommand): Promise<CreateCollectionResult> {
    if (!cmd.queryId && (!cmd.patientIds || cmd.patientIds.length === 0)) {
      throw new CollectionNotFoundError('either queryId or patientIds must be provided');
    }

    let patientIds = cmd.patientIds ?? [];
    let queryId: string | null = cmd.queryId ?? null;

    // Derive the cohort from a saved query when no explicit IDs given.
    if (patientIds.length === 0 && queryId) {
      const result = await this.executeQueryHandler.execute({
        queryId,
        organizationId: cmd.organizationId,
      });
      patientIds = result.rows.map((r) => r.patientId);
    }

    const id = randomUUID();
    const collection =
      queryId != null
        ? PatientCollection.fromQuery({
            id,
            organizationId: cmd.organizationId,
            createdBy: cmd.createdBy,
            name: cmd.name,
            queryId,
            patientIds,
            description: cmd.description ?? undefined,
          })
        : PatientCollection.create({
            id,
            organizationId: cmd.organizationId,
            createdBy: cmd.createdBy,
            name: cmd.name,
            description: cmd.description ?? undefined,
          });

    const saved = await this.collectionRepo.save(
      patientIds.length > 0 && queryId == null
        ? collection.addMembers(patientIds, cmd.createdBy)
        : collection,
    );

    return {
      id: saved.id,
      name: saved.name,
      queryId: saved.queryId,
      patientCount: saved.patientCount,
      isLocked: saved.isLocked,
      createdAt: saved.createdAt.toISOString(),
    };
  }
}