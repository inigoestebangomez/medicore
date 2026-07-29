// apps/api/src/application/research/services/p-value-format.ts
// BR-RES-006: p-value formatting utility. Three decimals, or "<0.001" below
// the threshold. Used by Table1, group comparison, and pre/post analysis.
export function formatPValue(p: number | null, threshold = 0.001): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  if (p < threshold) return '<0.001';
  return p.toFixed(3);
}

/** Round to a fixed number of decimals, returning null string on missing values. */
export function fmt(value: number | null, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(decimals);
}