// apps/api/src/infrastructure/database/repositories/ai-report-usage.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  IAiReportUsageRepository,
  AiReportUsageState,
} from '@/domain/billing/ai-report-usage.repository.interface';

/**
 * Prisma implementation of the AI report usage counter (BR-REP-009).
 *
 * The race-safe upsert is the core guarantee: it MUST atomically increment the
 * month's counter only while below the plan limit, with no TOCTOU window. We
 * implement this with `executeRaw` UPSERT ... ON CONFLICT DO UPDATE ... WHERE
 * count < $limit RETURNING count, inside `prisma.$transaction`. Returning 0
 * rows means the limit was already reached.
 *
 * When `limit` is `null` (unlimited / ENTERPRISE) we always increment with no
 * WHERE guard, so the count grows but is never blocked.
 */
@Injectable()
export class PrismaAiReportUsageRepository implements IAiReportUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async tryIncrement(
    organizationId: string,
    yearMonth: string,
    limit: number | null,
  ): Promise<{ count: number } | null> {
    if (limit === null) {
      // Unlimited: always increment, never block.
      const count = await this.bump(organizationId, yearMonth);
      return { count };
    }

    return this.prisma.$transaction(async (tx) => {
      // UPSERT with a guarded SET: only bumps when the stored count is below
      // the limit. The WHERE applies to the UPDATE branch (existing row).
      // For a fresh row (INSERT branch) count defaults to 1 and is always
      // allowed because a new row means count was effectively 0 < limit.
      const guarded = limit > 0
        ? `WHERE "ai_report_usage"."count" < $4`
        : `WHERE false`; // limit === 0 → never allow any reports

      const sql = `
        INSERT INTO "ai_report_usage" ("id", "organizationId", "yearMonth", "count", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, 1, NOW(), NOW())
        ON CONFLICT ("organizationId", "yearMonth")
        DO UPDATE SET "count" = "ai_report_usage"."count" + 1,
                      "updatedAt" = NOW()
        ${guarded}
        RETURNING "count" AS count;
      `;

      const rows: Array<{ count: bigint }> = await tx.$queryRawUnsafe(
        sql,
        organizationId,
        yearMonth,
        1,
        limit,
      );

      if (rows.length === 0) {
        return null; // limit reached
      }
      return { count: Number(rows[0].count) };
    });
  }

  async getCurrent(
    organizationId: string,
    yearMonth: string,
  ): Promise<AiReportUsageState | null> {
    const record = await this.prisma.aiReportUsage.findUnique({
      where: {
        organizationId_yearMonth: { organizationId, yearMonth },
      },
      select: { organizationId: true, yearMonth: true, count: true },
    });
    if (!record) return null;
    return {
      organizationId: record.organizationId,
      yearMonth: record.yearMonth,
      count: record.count,
    };
  }

  /** Unguarded increment for unlimited plans. */
  private async bump(organizationId: string, yearMonth: string): Promise<number> {
    const sql = `
      INSERT INTO "ai_report_usage" ("id", "organizationId", "yearMonth", "count", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, 1, NOW(), NOW())
      ON CONFLICT ("organizationId", "yearMonth")
      DO UPDATE SET "count" = "ai_report_usage"."count" + 1,
                    "updatedAt" = NOW()
      RETURNING "count" AS count;
    `;
    const rows: Array<{ count: bigint }> = await this.prisma.$queryRawUnsafe(
      sql,
      organizationId,
      yearMonth,
    );
    return rows.length > 0 ? Number(rows[0].count) : 1;
  }
}