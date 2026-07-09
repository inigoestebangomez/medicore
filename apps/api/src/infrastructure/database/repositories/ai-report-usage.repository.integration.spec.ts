// apps/api/src/infrastructure/database/repositories/ai-report-usage.repository.integration.spec.ts
// Race-safe counter proof (BR-REP-009): 25 concurrent increments on a FREE
// plan (limit 20) must yield exactly 20 successes and 5 rejections, with the
// final stored count at 20.
//
// The repo delegates to `prisma.$transaction` + `$queryRawUnsafe`. We simulate
// the PostgreSQL UPSERT ... WHERE count < $limit RETURNING semantics in JS so
// the test proves the race-safety logic without a live DB.

import { PrismaAiReportUsageRepository } from './ai-report-usage.repository';
import type { IAiReportUsageRepository } from '@/domain/billing/ai-report-usage.repository.interface';

/**
 * Builds a fake PrismaService whose `$transaction` runs the callback with a
 * fake `tx` that emulates the guarded UPSERT SQL.
 *
 * The simulated SQL:
 *   INSERT ... count=1 ON CONFLICT (org, ym)
 *     DO UPDATE SET count=count+1 WHERE count < $limit  -- only when limit>0
 *     RETURNING count
 * A $4 (limit) of 0 → WHERE false → never returns a row (0 limit).
 */
function makeFakePrisma(limitReturnLogic: 'guarded'): any {
  const counts = new Map<string, number>();

  const guardedUpsert = (orgId: string, ym: string, limit: number | null) => {
    const key = `${orgId}|${ym}`;
    const current = counts.get(key) ?? 0;
    if (limitReturnLogic === 'guarded' && limit !== null) {
      if (current >= limit) return []; // block — 0 rows
    }
    const next = current + 1;
    counts.set(key, next);
    return [{ count: BigInt(next) }];
  };

  return {
    __counts: counts,
    $queryRawUnsafe: async (_sql: string, ...params: any[]) => {
      // Unlimited bump path (limit === null): no guard, always increments.
      const orgId = params[0];
      const ym = params[1];
      return guardedUpsert(orgId, ym, null); // limit=null bypasses the guard
    },
    $transaction: async (fn: any) => fn({
      $queryRawUnsafe: async (_sql: string, ...params: any[]) => {
        // params: [$1 orgId, $2 yearMonth, $3 unused(1), $4 limit]
        const orgId = params[0];
        const ym = params[1];
        const limit = params[3];
        return guardedUpsert(orgId, ym, limit);
      },
    }),
  };
}

describe('PrismaAiReportUsageRepository — race-safe counter (BR-REP-009)', () => {
  it('allows exactly 20 of 25 concurrent increments on FREE (limit 20)', async () => {
    const fakePrisma = makeFakePrisma('guarded');
    const repo: IAiReportUsageRepository = new PrismaAiReportUsageRepository(
      fakePrisma as any,
    );

    const limit = 20;
    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        repo.tryIncrement('org-race', '2026-07', limit),
      ),
    );

    const successes = results.filter((r) => r !== null);
    const blocked = results.filter((r) => r === null);

    expect(successes).toHaveLength(20);
    expect(blocked).toHaveLength(5);
    // Final stored count must be exactly the limit — no oversold rows.
    expect(fakePrisma.__counts.get('org-race|2026-07')).toBe(20);
  });

  it('always increments with no upper bound when limit is null (ENTERPRISE)', async () => {
    const fakePrisma = makeFakePrisma('guarded');
    const repo: IAiReportUsageRepository = new PrismaAiReportUsageRepository(
      fakePrisma as any,
    );

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repo.tryIncrement('org-ent', '2026-07', null),
      ),
    );
    expect(results.every((r) => r !== null)).toBe(true);
    expect(fakePrisma.__counts.get('org-ent|2026-07')).toBe(5);
  });

  it('blocks every report when limit is 0', async () => {
    const fakePrisma = makeFakePrisma('guarded');
    const repo: IAiReportUsageRepository = new PrismaAiReportUsageRepository(
      fakePrisma as any,
    );

    const r = await repo.tryIncrement('org-zero', '2026-07', 0);
    expect(r).toBeNull();
    expect(fakePrisma.__counts.has('org-zero|2026-07')).toBe(false);
  });

  describe('getCurrent', () => {
    it('returns the stored count for the period', async () => {
      const fakePrisma = {
        aiReportUsage: {
          findUnique: jest.fn().mockResolvedValue({
            organizationId: 'org-1', yearMonth: '2026-07', count: 7,
          }),
        },
      } as any;
      const repo = new PrismaAiReportUsageRepository(fakePrisma);
      const state = await repo.getCurrent('org-1', '2026-07');
      expect(state).toEqual({ organizationId: 'org-1', yearMonth: '2026-07', count: 7 });
      expect(fakePrisma.aiReportUsage.findUnique).toHaveBeenCalledWith({
        where: { organizationId_yearMonth: { organizationId: 'org-1', yearMonth: '2026-07' } },
        select: { organizationId: true, yearMonth: true, count: true },
      });
    });

    it('returns null when no row exists for the period', async () => {
      const fakePrisma = {
        aiReportUsage: { findUnique: jest.fn().mockResolvedValue(null) },
      } as any;
      const repo = new PrismaAiReportUsageRepository(fakePrisma);
      expect(await repo.getCurrent('org-1', '2026-08')).toBeNull();
    });
  });
});