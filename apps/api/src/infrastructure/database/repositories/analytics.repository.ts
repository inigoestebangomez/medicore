// apps/api/src/infrastructure/database/repositories/analytics.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  IAnalyticsRepository,
  AnalyticsFilters,
  AnalyticsOverview,
  DiagnosisDistributionItem,
  ScaleEvolutionData,
} from '@/domain/analytics/analytics.repository.interface';

const DEFAULT_MONTHS_LOOKBACK = 12;
const LOW_SAMPLE_WARNING = 'Tamaño de muestra insuficiente para significancia estadística';
const LOW_SAMPLE_THRESHOLD = 20;

function defaultDateRange(from?: Date, to?: Date): { from: Date; to: Date } {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getFullYear(), end.getMonth() - DEFAULT_MONTHS_LOOKBACK, 1);
  return { from: start, to: end };
}

@Injectable()
export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
    const { from, to } = defaultDateRange(filters.from, filters.to);
    const orgId = filters.organizationId;

    const [
      totalPatients,
      newPatients,
      totalConsultations,
      totalSurgeries,
      reportsGenerated,
      aiReportsGenerated,
    ] = await Promise.all([
      this.prisma.patient.count({
        where: { organizationId: orgId, deletedAt: null },
      }),
      this.prisma.patient.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.consultation.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          date: { gte: from, lte: to },
        },
      }),
      this.prisma.surgery.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          date: { gte: from, lte: to },
        },
      }),
      this.prisma.report.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.report.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          aiGenerated: true,
          createdAt: { gte: from, lte: to },
        },
      }),
    ]);

    const avgConsultationsPerPatient =
      totalPatients > 0 ? totalConsultations / totalPatients : 0;

    return {
      totalPatients,
      newPatients,
      totalConsultations,
      totalSurgeries,
      avgConsultationsPerPatient: Math.round(avgConsultationsPerPatient * 100) / 100,
      reportsGenerated,
      aiReportsGenerated,
      period: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async getDiagnosisDistribution(
    filters: AnalyticsFilters & { system?: 'ICD10' | 'SNOMED'; limit?: number },
  ): Promise<DiagnosisDistributionItem[]> {
    const { from, to } = defaultDateRange(filters.from, filters.to);
    const limit = filters.limit ?? 20;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ code: string; description: string; count: bigint; percentage: number }>
    >(
      `
      SELECT
        elem->>'code' AS code,
        elem->>'description' AS description,
        COUNT(*) AS count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
      FROM "consultations" c,
           jsonb_array_elements(c."diagnosisCodes") elem
      WHERE c."organizationId" = $1
        AND c."deletedAt" IS NULL
        AND c."diagnosisCodes" IS NOT NULL
        AND (elem->>'system' = $2 OR $2 IS NULL)
        AND c.date >= $3::timestamptz
        AND c.date <= $4::timestamptz
      GROUP BY elem->>'code', elem->>'description'
      ORDER BY count DESC
      LIMIT $5
      `,
      filters.organizationId,
      filters.system ?? null,
      from,
      to,
      limit,
    );

    return rows.map((row) => ({
      code: row.code,
      description: row.description,
      count: Number(row.count),
      percentage: Number(row.percentage),
    }));
  }

  async getScaleEvolution(
    filters: AnalyticsFilters & { scaleType: string; diagnosisCode?: string },
  ): Promise<ScaleEvolutionData> {
    const { from, to } = defaultDateRange(filters.from, filters.to);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        total: number;
        month: string;
        monthly_avg: number;
        monthly_count: number;
      }>
    >(
      `
      SELECT
        s."total"::int AS total,
        TO_CHAR(s.date, 'YYYY-MM') AS month,
        AVG(s."total") OVER (PARTITION BY TO_CHAR(s.date, 'YYYY-MM')) AS monthly_avg,
        COUNT(*) OVER (PARTITION BY TO_CHAR(s.date, 'YYYY-MM')) AS monthly_count
      FROM "clinical_scales" s
      WHERE s."organizationId" = $1
        AND s."scaleType" = $2::"ClinicalScaleType"
        AND s."deletedAt" IS NULL
        AND s.date >= $3::timestamptz
        AND s.date <= $4::timestamptz
      ORDER BY month
      `,
      filters.organizationId,
      filters.scaleType,
      from,
      to,
    );

    const sampleSize = rows.length;

    if (sampleSize === 0) {
      return {
        scaleType: filters.scaleType,
        sampleSize: 0,
        avgScore: 0,
        medianScore: 0,
        distribution: {},
        trend: [],
        warning: LOW_SAMPLE_WARNING,
      };
    }

    const totals = rows.map((r) => r.total).sort((a, b) => a - b);

    const avgScore = totals.reduce((sum, v) => sum + v, 0) / sampleSize;

    let medianScore: number;
    const mid = Math.floor(sampleSize / 2);
    if (sampleSize % 2 === 0) {
      medianScore = (totals[mid - 1] + totals[mid]) / 2;
    } else {
      medianScore = totals[mid];
    }

    const distribution: Record<string, number> = {};
    const bucketSize = 10;
    for (const total of totals) {
      const bucketMin = Math.floor(total / bucketSize) * bucketSize;
      const bucketMax = bucketMin + bucketSize - 1;
      const key = `${bucketMin}-${bucketMax}`;
      distribution[key] = (distribution[key] ?? 0) + 1;
    }

    const trendMap = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const entry = trendMap.get(row.month) ?? { sum: 0, count: 0 };
      entry.sum += row.total;
      entry.count += 1;
      trendMap.set(row.month, entry);
    }

    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { sum, count }]) => ({
        month,
        avgScore: Math.round((sum / count) * 100) / 100,
        sampleSize: count,
      }));

    return {
      scaleType: filters.scaleType,
      sampleSize,
      avgScore: Math.round(avgScore * 100) / 100,
      medianScore,
      distribution,
      trend,
      warning: sampleSize < LOW_SAMPLE_THRESHOLD ? LOW_SAMPLE_WARNING : null,
    };
  }
}
