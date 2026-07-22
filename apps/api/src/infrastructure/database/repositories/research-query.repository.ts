// apps/api/src/infrastructure/database/repositories/research-query.repository.ts
// Prisma implementation of IResearchQueryRepository.
// Tenant isolation: all reads scoped by organizationId. Privacy (BR-RES-001):
// findByOrg only returns queries the user created or that are shared with them.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ResearchQuery } from '@/domain/research/research-query.entity';
import type {
  IResearchQueryRepository,
  SaveResearchQueryInput,
} from '@/domain/research/research-query.repository.interface';
import type {
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
} from '@medicore/contracts';

@Injectable()
export class PrismaResearchQueryRepository implements IResearchQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(query: ResearchQuery): Promise<ResearchQuery> {
    const data = this.toPrismaCreate(query) as any;
    const record = await this.prisma.researchQuery.upsert({
      where: { id: query.id },
      create: data,
      update: data,
    });
    return this.toEntity(record);
  }

  async findById(id: string, organizationId: string): Promise<ResearchQuery | null> {
    const record = await this.prisma.researchQuery.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByOrg(params: {
    organizationId: string;
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ResearchQuery[]; total: number }> {
    // BR-RES-001: only queries the user created or that are shared with them
    const where = {
      organizationId: params.organizationId,
      deletedAt: null,
      OR: [
        { createdBy: params.userId },
        { sharedWith: { has: params.userId } },
      ],
    };
    const [records, total] = await Promise.all([
      this.prisma.researchQuery.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.researchQuery.count({ where }),
    ]);
    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async update(query: ResearchQuery): Promise<ResearchQuery> {
    const record = await this.prisma.researchQuery.update({
      where: { id: query.id },
      data: {
        name: query.name,
        description: query.description,
        dataSource: query.dataSource,
        importBatchIds: query.importBatchIds,
        filters: query.filters as any,
        filterLogic: query.filterLogic,
        displayFields: query.displayFields,
        visualizations: query.visualizations,
        sharedWith: query.sharedWith,
        updatedAt: new Date(),
      },
    });
    return this.toEntity(record);
  }

  async updateRunStats(
    id: string,
    organizationId: string,
    count: number,
  ): Promise<ResearchQuery> {
    const record = await this.prisma.researchQuery.update({
      where: { id },
      data: { lastRunAt: new Date(), lastRunCount: count },
    });
    void organizationId;
    return this.toEntity(record);
  }

  async shareWith(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<ResearchQuery> {
    const record = await this.prisma.researchQuery.update({
      where: { id },
      data: { sharedWith: { push: userId } },
    });
    void organizationId;
    return this.toEntity(record);
  }

  async unshareWith(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<ResearchQuery> {
    const existing = await this.prisma.researchQuery.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new Error(`Research query not found: ${id}`);
    }
    const updated = (existing.sharedWith as string[]).filter(
      (uid) => uid !== userId,
    );
    const record = await this.prisma.researchQuery.update({
      where: { id },
      data: { sharedWith: updated },
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, organizationId: string): Promise<ResearchQuery> {
    const record = await this.prisma.researchQuery.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    void organizationId;
    return this.toEntity(record);
  }

  // ─────────────────────────────────────────────
  // Mapping
  // ─────────────────────────────────────────────

  private toPrismaCreate(query: ResearchQuery): Record<string, unknown> {
    return {
      id: query.id,
      organizationId: query.organizationId,
      createdBy: query.createdBy,
      name: query.name,
      description: query.description,
      dataSource: query.dataSource,
      importBatchIds: query.importBatchIds,
      filters: query.filters,
      filterLogic: query.filterLogic,
      displayFields: query.displayFields,
      visualizations: query.visualizations,
      sharedWith: query.sharedWith,
      lastRunAt: query.lastRunAt,
      lastRunCount: query.lastRunCount,
    };
  }

  private toEntity(record: any): ResearchQuery {
    return new ResearchQuery({
      id: record.id,
      organizationId: record.organizationId,
      createdBy: record.createdBy,
      name: record.name,
      description: record.description,
      dataSource: record.dataSource as DataSource,
      importBatchIds: record.importBatchIds as string[],
      filters: record.filters as Filter[],
      filterLogic: record.filterLogic as FilterLogic,
      displayFields: record.displayFields as string[],
      visualizations: record.visualizations as VisualizationType[],
      sharedWith: (record.sharedWith as string[]) ?? [],
      lastRunAt: record.lastRunAt,
      lastRunCount: record.lastRunCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}

// Re-export for convenience
export type { SaveResearchQueryInput };