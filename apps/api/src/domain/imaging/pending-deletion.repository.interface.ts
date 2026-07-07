// apps/api/src/domain/imaging/pending-deletion.repository.interface.ts

export interface PendingDeletionRecord {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  fileKey: string;
  scheduledAt: Date;
  processedAt: Date | null;
  createdAt: Date;
}

export interface CreatePendingDeletionInput {
  organizationId: string;
  entityType: string;
  entityId: string;
  fileKey: string;
  scheduledAt: Date;
}

export interface IPendingDeletionRepository {
  create(data: CreatePendingDeletionInput): Promise<PendingDeletionRecord>;
  findDue(now: Date): Promise<PendingDeletionRecord[]>;
  markProcessed(id: string): Promise<void>;
}