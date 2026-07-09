// apps/api/src/domain/billing/year-month.ts
/**
 * Returns the current calendar month as a "YYYY-MM" string.
 * Used as the partition key for AiReportUsage counters.
 */
export function getYearMonth(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Convenience alias used by controllers that want "the current month". */
export function getCurrentYearMonth(): string {
  return getYearMonth();
}