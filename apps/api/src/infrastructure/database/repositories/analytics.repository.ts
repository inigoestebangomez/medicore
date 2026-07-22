// apps/api/src/infrastructure/database/repositories/analytics.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  IAnalyticsRepository,
  AnalyticsFilters,
  AnalyticsOverview,
  DiagnosisDistributionItem,
  ScaleEvolutionData,
  DashboardStats,
  DashboardStatsChange,
} from '@/domain/analytics/analytics.repository.interface';

type CountRow = { count: bigint };
type MonthNewRow = { month: string; new_val: bigint };
type MonthCountRow = { month: string; count_val: bigint };
type WeekCountRow = { week: string; count_val: bigint };
type GroupCountRow = { key: string; count_val: bigint };
type MonthTotalRow = { month: string; total_val: number };
type GroupTotalRow = { key: string; total_val: number };
type NextAppointmentRow = { time: string; first_name: string; last_name: string };

function computeChange(
  thisPeriod: number,
  lastPeriod: number,
  period: 'month' | 'week',
): DashboardStatsChange {
  const value = thisPeriod - lastPeriod;
  let percent: number;
  if (lastPeriod === 0) {
    percent = thisPeriod > 0 ? 100 : 0;
  } else {
    percent = Math.round((value / lastPeriod) * 10000) / 100;
  }
  return { value, percent, period };
}

function toRecord(rows: GroupCountRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.key ?? 'UNKNOWN'] = Number(row.count_val);
  }
  return out;
}

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

  async getDashboardStats(organizationId: string): Promise<DashboardStats> {
    const [
      patientTotalRows,
      patientThisMonthRows,
      patientLastMonthRows,
      patientMonthlyRows,
      appointmentTotalRows,
      appointmentThisWeekRows,
      appointmentLastWeekRows,
      appointmentWeeklyRows,
      appointmentByTypeRows,
      surgeryTotalRows,
      surgeryThisMonthRows,
      surgeryLastMonthRows,
      surgeryMonthlyRows,
      surgeryByStatusRows,
      treatmentActiveRows,
      treatmentNewThisMonthRows,
      treatmentMonthlyRows,
      billingThisMonthRows,
      billingLastMonthRows,
      billingMonthlyRows,
      billingByTypeRows,
      todayAppointmentsRows,
      todaySurgeriesRows,
      nextAppointmentRows,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM patients WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM patients WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND "createdAt" >= date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM patients WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND "createdAt" >= date_trunc('month', NOW() - INTERVAL '1 month') AND "createdAt" < date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<MonthNewRow[]>(
        `SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::bigint AS new_val FROM patients WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '12 months' GROUP BY month ORDER BY month`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM consultations WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM consultations WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= date_trunc('week', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM consultations WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= date_trunc('week', NOW() - INTERVAL '1 week') AND date < date_trunc('week', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<WeekCountRow[]>(
        `SELECT TO_CHAR(date, 'IYYY-"W"IW') AS week, COUNT(*)::bigint AS count_val FROM consultations WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= NOW() - INTERVAL '4 weeks' GROUP BY week ORDER BY week`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<GroupCountRow[]>(
        `SELECT type::text AS key, COUNT(*)::bigint AS count_val FROM consultations WHERE "organizationId" = $1 AND "deletedAt" IS NULL GROUP BY type`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM surgeries WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM surgeries WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM surgeries WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= date_trunc('month', NOW() - INTERVAL '1 month') AND date < date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<MonthCountRow[]>(
        `SELECT TO_CHAR(date, 'YYYY-MM') AS month, COUNT(*)::bigint AS count_val FROM surgeries WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= NOW() - INTERVAL '12 months' GROUP BY month ORDER BY month`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<GroupCountRow[]>(
        `SELECT status::text AS key, COUNT(*)::bigint AS count_val FROM surgeries WHERE "organizationId" = $1 AND "deletedAt" IS NULL GROUP BY status`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM medication_prescriptions WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND status = 'ACTIVE'`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM medication_prescriptions WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND "startDate" >= date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<MonthNewRow[]>(
        `SELECT TO_CHAR("startDate", 'YYYY-MM') AS month, COUNT(*)::bigint AS new_val FROM medication_prescriptions WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND "startDate" >= NOW() - INTERVAL '12 months' GROUP BY month ORDER BY month`,
        organizationId,
      ),
      // Billing
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COALESCE(SUM(amount),0)::bigint AS count FROM billing_transactions WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND status = 'PAID' AND date >= date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COALESCE(SUM(amount),0)::bigint AS count FROM billing_transactions WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND status = 'PAID' AND date >= date_trunc('month', NOW() - INTERVAL '1 month') AND date < date_trunc('month', NOW())`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<MonthTotalRow[]>(
        `SELECT TO_CHAR(date, 'YYYY-MM') AS month, COALESCE(SUM(amount),0)::float8 AS total_val FROM billing_transactions WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND status = 'PAID' AND date >= NOW() - INTERVAL '12 months' GROUP BY month ORDER BY month`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<GroupTotalRow[]>(
        `SELECT type::text AS key, COALESCE(SUM(amount),0)::float8 AS total_val FROM billing_transactions WHERE "organizationId" = $1 AND "deletedAt" IS NULL GROUP BY type`,
        organizationId,
      ),
      // Schedule (today)
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM consultations WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= date_trunc('day', NOW()) AND date < date_trunc('day', NOW()) + INTERVAL '1 day'`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS count FROM surgeries WHERE "organizationId" = $1 AND "deletedAt" IS NULL AND date >= date_trunc('day', NOW()) AND date < date_trunc('day', NOW()) + INTERVAL '1 day'`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<NextAppointmentRow[]>(
        `
        SELECT TO_CHAR(c.date, 'HH24:MI') AS time, p."firstName" AS first_name, p."lastName" AS last_name
        FROM consultations c
        JOIN patients p ON p.id = c."patientId"
        WHERE c."organizationId" = $1 AND c."deletedAt" IS NULL AND c.date >= NOW()
        ORDER BY c.date ASC
        LIMIT 1
        `,
        organizationId,
      ),
    ]);

    const toNum = (rows: CountRow[]) => (rows[0]?.count !== undefined ? Number(rows[0].count) : 0);

    return {
      patients: {
        total: toNum(patientTotalRows),
        change: computeChange(toNum(patientThisMonthRows), toNum(patientLastMonthRows), 'month'),
        monthly: patientMonthlyRows.map((r) => ({ month: r.month, new: Number(r.new_val) })),
      },
      appointments: {
        total: toNum(appointmentTotalRows),
        change: computeChange(toNum(appointmentThisWeekRows), toNum(appointmentLastWeekRows), 'week'),
        weekly: appointmentWeeklyRows.map((r) => ({ week: r.week, count: Number(r.count_val) })),
        byType: toRecord(appointmentByTypeRows),
      },
      surgeries: {
        total: toNum(surgeryTotalRows),
        change: computeChange(toNum(surgeryThisMonthRows), toNum(surgeryLastMonthRows), 'month'),
        monthly: surgeryMonthlyRows.map((r) => ({ month: r.month, count: Number(r.count_val) })),
        byStatus: toRecord(surgeryByStatusRows),
      },
      treatments: {
        active: toNum(treatmentActiveRows),
        newThisMonth: toNum(treatmentNewThisMonthRows),
        monthly: treatmentMonthlyRows.map((r) => ({ month: r.month, new: Number(r.new_val) })),
      },
      billing: {
        totalThisMonth: Number(billingThisMonthRows[0]?.count ?? 0),
        change: computeChange(
          Number(billingThisMonthRows[0]?.count ?? 0),
          Number(billingLastMonthRows[0]?.count ?? 0),
          'month',
        ),
        monthly: billingMonthlyRows.map((r) => ({ month: r.month, total: Number(r.total_val) })),
        byType: toRecord(billingByTypeRows.map((r) => ({ key: r.key, count_val: r.total_val } as any))),
      },
      schedule: {
        todayAppointments: toNum(todayAppointmentsRows),
        todaySurgeries: toNum(todaySurgeriesRows),
        nextAppointment: nextAppointmentRows[0]
          ? {
              time: nextAppointmentRows[0].time,
              patientName: `${nextAppointmentRows[0].first_name} ${nextAppointmentRows[0].last_name}`.trim(),
            }
          : null,
      },
    };
  }
}
