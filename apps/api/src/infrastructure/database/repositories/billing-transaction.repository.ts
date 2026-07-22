// apps/api/src/infrastructure/database/repositories/billing-transaction.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  IBillingTransactionRepository,
  BillingTransaction,
  ListBillingTransactionsParams,
  CreateBillingTransactionInput,
  BillingStats,
} from '@/domain/billing/billing-transaction.repository.interface';

type CountRow = { count: bigint };
type MonthTotalRow = { month: string; total_val: number };
type GroupTotalRow = { key: string; total_val: number };

@Injectable()
export class PrismaBillingTransactionRepository implements IBillingTransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListBillingTransactionsParams): Promise<{ items: BillingTransaction[]; total: number }> {
    const where: Record<string, unknown> = {
      organizationId: params.organizationId,
      deletedAt: null,
    };
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.gte = params.from;
      if (params.to) dateFilter.lte = params.to;
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      this.prisma.billingTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.billingTransaction.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async create(data: CreateBillingTransactionInput): Promise<BillingTransaction> {
    const record = await this.prisma.billingTransaction.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId ?? null,
        consultationId: data.consultationId ?? null,
        surgeryId: data.surgeryId ?? null,
        amount: data.amount,
        type: (data.type ?? 'OTHER') as any,
        status: (data.status ?? 'PENDING') as any,
        description: data.description ?? null,
        date: data.date ?? new Date(),
      },
    });
    return this.toEntity(record);
  }

  async getStats(organizationId: string): Promise<BillingStats> {
    const [thisMonthRows, lastMonthRows, monthlyRows, byTypeRows] = await Promise.all([
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
    ]);

    const totalThisMonth = Number(thisMonthRows[0]?.count ?? 0);
    const lastMonth = Number(lastMonthRows[0]?.count ?? 0);
    const value = totalThisMonth - lastMonth;
    const percent = lastMonth === 0 ? (totalThisMonth > 0 ? 100 : 0) : Math.round((value / lastMonth) * 10000) / 100;

    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.key ?? 'UNKNOWN'] = Number(row.total_val);
    }

    return {
      totalThisMonth,
      change: { value, percent, period: 'month' },
      monthly: monthlyRows.map((r) => ({ month: r.month, total: Number(r.total_val) })),
      byType,
    };
  }

  private toEntity(record: any): BillingTransaction {
    return {
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId ?? null,
      consultationId: record.consultationId ?? null,
      surgeryId: record.surgeryId ?? null,
      amount: record.amount,
      type: record.type,
      status: record.status,
      description: record.description ?? null,
      date: record.date,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    };
  }
}