// apps/api/src/infrastructure/database/repositories/research-study.repository.ts
// Prisma adapter for IResearchStudyRepository (M8). Tenant isolation: every
// read scoped by organizationId. Soft delete via deletedAt.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { StudyStatusLiteral } from '@/domain/research/value-objects/study-status.vo';
import type {
  IResearchStudyRepository,
  Paginated,
} from '@/domain/research/ports/research-study.repository.interface';

@Injectable()
export class PrismaResearchStudyRepository implements IResearchStudyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(study: ResearchStudy): Promise<ResearchStudy> {
    const record = await this.prisma.researchStudy.create({
      data: this.toPrismaCreate(study) as any,
    });
    return this.toEntity(record);
  }

  async findById(id: string, organizationId: string): Promise<ResearchStudy | null> {
    const record = await this.prisma.researchStudy.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByOrganization(
    organizationId: string,
    opts: { status?: StudyStatusLiteral; page?: number; pageSize?: number } = {},
  ): Promise<Paginated<ResearchStudy>> {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where: any = { organizationId, deletedAt: null };
    if (opts.status) where.status = opts.status;
    const [records, total] = await Promise.all([
      this.prisma.researchStudy.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.researchStudy.count({ where }),
    ]);
    return { items: records.map((r) => this.toEntity(r)), total, page, pageSize };
  }

  async update(study: ResearchStudy): Promise<ResearchStudy> {
    const record = await this.prisma.researchStudy.update({
      where: { id: study.id },
      data: this.toPrismaUpdate(study),
    });
    return this.toEntity(record);
  }

  async findActiveWithStaleCache(organizationId: string, hours: number): Promise<ResearchStudy[]> {
    const threshold = new Date(Date.now() - hours * 3600 * 1000);
    const records = await this.prisma.researchStudy.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [{ cachedAt: null }, { cachedAt: { lt: threshold } }],
      },
    });
    return records.map((r) => this.toEntity(r));
  }

  async softDelete(id: string, organizationId: string): Promise<void> {
    await this.prisma.researchStudy.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    void organizationId;
  }

  // Mapping ──────────────────────────────────────
  private toPrismaCreate(s: ResearchStudy): Record<string, unknown> {
    return {
      id: s.id,
      organizationId: s.organizationId,
      createdBy: s.createdBy,
      queryId: s.queryId,
      studyType: s.studyType,
      name: s.name,
      description: s.description,
      status: s.status.value,
      cachedPatientIds: s.cachedPatientIds,
      cachedAt: s.cachedAt,
      patientCount: s.patientCount,
      analyses: s.analyses as any,
      publicationRef: s.publicationRef,
      frozenAt: s.frozenAt,
    };
  }

  private toPrismaUpdate(s: ResearchStudy): Record<string, unknown> {
    return {
      name: s.name,
      description: s.description,
      status: s.status.value,
      cachedPatientIds: s.cachedPatientIds,
      cachedAt: s.cachedAt,
      patientCount: s.patientCount,
      analyses: s.analyses as any,
      publicationRef: s.publicationRef,
      frozenAt: s.frozenAt,
      updatedAt: new Date(),
    };
  }

  private toEntity(record: any): ResearchStudy {
    return new ResearchStudy({
      id: record.id,
      organizationId: record.organizationId,
      createdBy: record.createdBy,
      queryId: record.queryId,
      studyType: record.studyType ?? 'QUERY',
      name: record.name,
      description: record.description,
      status: record.status,
      cachedPatientIds: Array.isArray(record.cachedPatientIds) ? record.cachedPatientIds : [],
      cachedAt: record.cachedAt,
      patientCount: record.patientCount ?? 0,
      analyses: Array.isArray(record.analyses) ? record.analyses : [],
      publicationRef: record.publicationRef,
      frozenAt: record.frozenAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}