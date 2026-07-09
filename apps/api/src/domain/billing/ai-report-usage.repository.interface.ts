// apps/api/src/domain/billing/ai-report-usage.repository.interface.ts
/**
 * Repository contract for per-organization monthly AI report usage counting.
 *
 * The race-safe `tryIncrement` is the core of BR-REP-009 enforcement: it must
 * atomically increment the month's counter only when below the plan limit,
 * returning the new count or `null` when the limit is reached.
 */

export interface AiReportUsageState {
  organizationId: string;
  yearMonth: string;
  count: number;
}

export interface IAiReportUsageRepository {
  /**
   * Atomically increment the usage counter for (orgId, yearMonth) when below
   * `limit`. Creates the row with count=1 if it does not exist.
   *
   * @returns the resulting `{ count }` when incremented, or `null` when the
   *          limit was already reached (0 rows updated).
   *          When `limit` is `null` (unlimited), always increments and returns
   *          the new count.
   */
  tryIncrement(
    organizationId: string,
    yearMonth: string,
    limit: number | null,
  ): Promise<{ count: number } | null>;

  /**
   * Current usage for (orgId, yearMonth). Returns `{ count: 0 }` when no row
   * exists yet (new month).
   */
  getCurrent(
    organizationId: string,
    yearMonth: string,
  ): Promise<AiReportUsageState | null>;
}