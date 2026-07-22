// apps/api/src/application/research/services/stats-calculator.service.ts
// Descriptive statistics for Research Engine (spec §10, design AD-5).
// Computes mean, median, stdDev, min, max, n, CI95% for both standard and
// imported (JSONB) numeric fields.
// BR-RES-004: categories with N<5 are dropped from distributions.

import { Injectable } from '@nestjs/common';
import type { FieldStats, CategoryDistribution } from '@medicore/contracts';

export interface RawPatientRow {
  patientId: string;
  nhc: string;
  [key: string]: unknown;
}

const MIN_SAMPLE_SIZE = 5; // BR-RES-004

@Injectable()
export class StatsCalculatorService {
  /**
   * Compute statistics for a set of numeric fields from the already-fetched
   * patient rows. Values are extracted from either standard typed columns
   * or imported JSONB fields (already flattened into the row by the query handler).
   */
  computeStats(
    rows: RawPatientRow[],
    numericFields: string[],
  ): FieldStats[] {
    const result: FieldStats[] = [];

    for (const field of numericFields) {
      const values = this.extractNumericValues(rows, field);
      const stats = this.computeFieldStats(field, values);
      result.push(stats);
    }

    return result;
  }

  /**
   * Compute a category distribution for a categorical field.
   * BR-RES-004: categories with N<5 are dropped.
   */
  computeDistribution(
    rows: RawPatientRow[],
    field: string,
  ): CategoryDistribution | null {
    const counts = new Map<string, number>();

    for (const row of rows) {
      const val = row[field];
      if (val === null || val === undefined || val === '') continue;
      const label = String(val);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    // BR-RES-004: drop categories with N<5
    const filteredCategories = Array.from(counts.entries())
      .filter(([, count]) => count >= MIN_SAMPLE_SIZE)
      .map(([label, count]) => ({
        label,
        count: count as number,
      }));

    // If all categories were dropped (everything <5), hide the distribution entirely
    if (filteredCategories.length === 0) {
      return null;
    }

    return {
      field,
      categories: filteredCategories,
    };
  }

  // ─────────────────────────────────────────────
  // Core statistics
  // ─────────────────────────────────────────────

  private computeFieldStats(field: string, values: number[]): FieldStats {
    const n = values.length;

    if (n < MIN_SAMPLE_SIZE) {
      // BR-RES-004: N<5 → hide stats (return nulls)
      return {
        field,
        n,
        mean: null,
        median: null,
        stdDev: null,
        min: null,
        max: null,
        ci95Lower: null,
        ci95Upper: null,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = this.mean(sorted);
    const median = this.median(sorted);
    const stdDev = this.standardDeviation(sorted, mean);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // CI95% = mean ± 1.96 * (SD / sqrt(n))
    const ciMargin = 1.96 * (stdDev / Math.sqrt(n));
    const ci95Lower = mean - ciMargin;
    const ci95Upper = mean + ciMargin;

    return {
      field,
      n,
      mean: this.round(mean),
      median: this.round(median),
      stdDev: this.round(stdDev),
      min,
      max,
      ci95Lower: this.round(ci95Lower),
      ci95Upper: this.round(ci95Upper),
    };
  }

  private extractNumericValues(rows: RawPatientRow[], field: string): number[] {
    const values: number[] = [];
    for (const row of rows) {
      const raw = row[field];
      if (raw === null || raw === undefined || raw === '') continue;
      const num = Number(raw);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        values.push(num);
      }
    }
    return values;
  }

  private mean(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    return sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  }

  private median(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Sample standard deviation (using N-1 in the denominator, like Excel/SPSS).
   */
  private standardDeviation(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const sumSquaredDiffs = values.reduce(
      (sum, v) => sum + Math.pow(v - mean, 2),
      0,
    );
    return Math.sqrt(sumSquaredDiffs / (values.length - 1));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100; // 2 decimal places
  }
}