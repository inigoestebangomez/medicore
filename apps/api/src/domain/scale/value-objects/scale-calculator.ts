// apps/api/src/domain/scale/value-objects/scale-calculator.ts
// BR-SCA-002: Server-side total recalculation for predefined scales
// Never trust client-sent total — always recalculate from scores

import type { ClinicalScaleType } from '@medicore/contracts';

/**
 * Calculate the total score for a clinical scale.
 * For predefined scales: sum all values (validated by Zod per-scale schema upstream)
 * For CUSTOM scales: sum all values (minimum 1 key validated upstream)
 *
 * Note: scaleType parameter is available for future scale-specific calculation logic
 * (e.g., weighted averages, subscale totals). Currently all scales use simple summation.
 */
export function calculateTotal(_scaleType: ClinicalScaleType, scores: Record<string, number>): number {
  return Object.values(scores).reduce((sum, value) => sum + value, 0);
}