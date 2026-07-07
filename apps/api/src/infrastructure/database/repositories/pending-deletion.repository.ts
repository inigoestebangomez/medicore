// apps/api/src/infrastructure/database/repositories/pending-deletion.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IPendingDeletionRepository, PendingDeletionRecord, CreatePendingDeletionInput } from '@/domain/imaging/pending-deletion.repository.interface';

@Injectable()
export class PrismaPendingDeletionRepository implements IPendingDeletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePendingDeletionInput): Promise<PendingDeletionRecord> {
    const record = await this.prisma.pendingDeletion.create({
      data: {
        organizationId: data.organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        fileKey: data.fileKey,
        scheduledAt: data.scheduledAt,
      },
    });
    return this.toEntity(record);
  }

  async findDue(now: Date): Promise<PendingDeletionRecord[]> {
    const records = await this.prisma.pendingDeletion.findMany({
      where: {
        scheduledAt: { lte: now },
        processedAt: null,
      },
    });
    return records.map((r) => this.toEntity(r));
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.pendingDeletion.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }

  private toEntity(record: any): PendingDeletionRecord {
    return {
      id: record.id,
      organizationId: record.organizationId,
      entityType: record.entityType,
      entityId: record.entityId,
      fileKey: record.fileKey,
      scheduledAt: record.scheduledAt,
      processedAt: record.processedAt ?? null,
      createdAt: record.createdAt,
    };
  }
}