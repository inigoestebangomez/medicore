// apps/api/src/infrastructure/database/repositories/import-batch.repository.ts
// Prisma implementation of IImportBatchRepository. Persists the ImportBatch
// aggregate (5-stage pipeline state machine). All reads are scoped by
// organizationId to enforce tenant isolation. Revert (BR-IMP-005) is a soft
// delete here — patient importedData[batchId] cleanup is handled by the
// revert use case, not the repository, to keep the snapshot logic explicit.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ImportBatch } from '@/domain/import/import-batch.entity';
import type {
  IImportBatchRepository,
  CreateImportBatchInput,
  UpdateAnalysisInput,
  UpdateCountersInput,
  ListImportBatchesParams,
} from '@/domain/import/import-batch.repository.interface';
import type { ImportStatus } from '@medicore/contracts';

@Injectable()
export class PrismaImportBatchRepository implements IImportBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persist(batch: ImportBatch): Promise<ImportBatch> {
    const data = this.toPrismaCreate(batch) as any; // Prisma ImportBatchUncheckedCreateInput shape
    // upsert keeps persist idempotent for the create-pending step.
    const record = await this.prisma.importBatch.upsert({
      where: { id: batch.id },
      create: data,
      update: data,
    });
    return this.toEntity(record);
  }

  async findById(id: string, organizationId: string): Promise<ImportBatch | null> {
    const record = await this.prisma.importBatch.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByOrg(params: ListImportBatchesParams): Promise<{ items: ImportBatch[]; total: number }> {
    const where: Record<string, unknown> = { organizationId: params.organizationId };
    if (params.status) where.status = params.status;
    const [records, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async updateAnalysis(id: string, organizationId: string, data: UpdateAnalysisInput): Promise<ImportBatch> {
    const record = await this.prisma.importBatch.update({
      where: { id },
      data: {
        columnMapping: data.columnMapping as any,
        customFieldNames: data.customFieldNames ?? undefined,
        junkRowIndices: data.junkRowIndices ?? undefined,
        aiConfidence: data.aiConfidence ?? undefined,
        aiProvider: data.aiProvider ?? undefined,
        issues: data.issues ?? undefined,
        notes: data.notes ?? undefined,
        skippedRows: data.skippedRows ?? undefined,
        status: 'CONFIRMING',
      },
    });
    void organizationId;
    return this.toEntity(record);
  }

  async updateStatus(id: string, organizationId: string, status: ImportStatus): Promise<ImportBatch> {
    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED') updateData.completedAt = new Date();
    if (status === 'FAILED') updateData.errorMessage = null;
    const record = await this.prisma.importBatch.update({ where: { id }, data: updateData });
    void organizationId;
    return this.toEntity(record);
  }

  async updateCounters(id: string, organizationId: string, counters: UpdateCountersInput): Promise<ImportBatch> {
    const record = await this.prisma.importBatch.update({
      where: { id },
      data: {
        importedRows: counters.importedRows,
        enrichedRows: counters.enrichedRows,
        createdRows: counters.createdRows,
        skippedRows: counters.skippedRows,
        pendingRows: counters.pendingRows,
      },
    });
    void organizationId;
    return this.toEntity(record);
  }

  async softDelete(id: string, organizationId: string): Promise<ImportBatch> {
    const record = await this.prisma.importBatch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    void organizationId;
    return this.toEntity(record);
  }

  async findLatestByOrg(organizationId: string): Promise<ImportBatch | null> {
    const record = await this.prisma.importBatch.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toEntity(record) : null;
  }

  // ─────────────────────────────────────────────
  // Mapping
  // ─────────────────────────────────────────────

  private toPrismaCreate(batch: ImportBatch): Record<string, unknown> {
    return {
      id: batch.id,
      organizationId: batch.organizationId,
      createdBy: batch.createdBy,
      fileName: batch.fileName,
      fileSize: batch.fileSize,
      fileHash: batch.fileHash,
      originalFormat: batch.originalFormat,
      sample: batch.sample as any,
      columnMapping: batch.columnMapping as any,
      customFieldNames: batch.customFieldNames ?? {},
      junkRowIndices: batch.junkRowIndices ?? [],
      aiConfidence: batch.aiConfidence,
      aiProvider: batch.aiProvider,
      issues: batch.issues,
      notes: batch.notes,
      totalRows: batch.totalRows,
      importedRows: batch.importedRows,
      enrichedRows: batch.enrichedRows,
      createdRows: batch.createdRows,
      skippedRows: batch.skippedRows,
      pendingRows: batch.pendingRows,
      snapshot: batch.snapshot,
      status: batch.status,
      errorMessage: batch.errorMessage,
      completedAt: batch.completedAt,
      deletedAt: batch.deletedAt,
    };
  }

  private toEntity(record: any): ImportBatch {
    return new ImportBatch({
      id: record.id,
      organizationId: record.organizationId,
      createdBy: record.createdBy,
      fileName: record.fileName,
      fileSize: record.fileSize,
      fileHash: record.fileHash,
      originalFormat: record.originalFormat,
      sample: record.sample,
      columnMapping: record.columnMapping,
      customFieldNames: record.customFieldNames,
      junkRowIndices: record.junkRowIndices,
      aiConfidence: record.aiConfidence,
      aiProvider: record.aiProvider,
      issues: record.issues,
      notes: record.notes,
      totalRows: record.totalRows,
      importedRows: record.importedRows,
      enrichedRows: record.enrichedRows,
      createdRows: record.createdRows,
      skippedRows: record.skippedRows,
      pendingRows: record.pendingRows,
      snapshot: record.snapshot,
      status: record.status,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
      deletedAt: record.deletedAt,
    });
  }
}

// Input type used by the create-pending use case; re-exported for convenience.
export type { CreateImportBatchInput };
