// apps/api/src/infrastructure/database/repositories/statistical-analysis.repository.ts
// Prisma adapter for IStatisticalAnalysisRepository (REQ-FB-012, V4).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StatisticalAnalysis } from '@/domain/research/statistical-analysis.entity';
import type { IStatisticalAnalysisRepository } from '@/domain/research/ports/statistical-analysis.repository.interface';

@Injectable()
export class PrismaStatisticalAnalysisRepository implements IStatisticalAnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(analysis: StatisticalAnalysis): Promise<StatisticalAnalysis> {
    const r = await this.prisma.statisticalAnalysis.create({ data: this.toCreate(analysis) as any });
    return this.toEntity(r);
  }

  async findByStudy(studyId: string, organizationId: string): Promise<StatisticalAnalysis[]> {
    const records = await this.prisma.statisticalAnalysis.findMany({
      where: { studyId, organizationId },
      orderBy: { executedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<StatisticalAnalysis | null> {
    const r = await this.prisma.statisticalAnalysis.findFirst({ where: { id, organizationId } });
    return r ? this.toEntity(r) : null;
  }

  private toCreate(a: StatisticalAnalysis): Record<string, unknown> {
    return {
      id: a.id,
      organizationId: a.organizationId,
      studyId: a.studyId,
      test: a.test,
      variableIds: a.variableIds,
      params: a.params,
      statistic: a.statistic,
      pValue: a.pValue,
      ci95: a.ci95,
      effectSize: a.effectSize,
      n: a.n,
      riskLabel: a.riskLabel?.value ?? null,
    };
  }

  private toEntity(r: any): StatisticalAnalysis {
    return new StatisticalAnalysis({
      id: r.id,
      organizationId: r.organizationId,
      studyId: r.studyId,
      test: r.test,
      variableIds: r.variableIds ?? [],
      params: r.params ?? {},
      statistic: r.statistic ?? null,
      pValue: r.pValue ?? null,
      ci95: r.ci95 ?? null,
      effectSize: r.effectSize ?? null,
      n: r.n ?? 0,
      riskLabel: r.riskLabel ?? null,
      executedAt: r.executedAt,
    });
  }
}