// apps/api/src/application/research/services/cross-tab.service.ts
// Cross-tabulation (spec §2, BR-RES-004). Builds a contingency table from
// extracted cohort field pairs, computes chi-square, Fisher exact (2×2
// auto-fallback when any expected cell < 5 per BR-RES-004), odds ratio with
// CI95 (Woolf), and applies N<5 cell suppression.
//
// Design decision: cross-tab stays in TS (light COUNT aggregations) and does
// NOT use Redis cache ("No Redis cache for cross-tabs — cheap COUNT queries").
// Python is reserved for the dedicated /research/stats/inferential endpoint
// (spec §1) where scipy/statsmodels materially help.

import { Injectable } from '@nestjs/common';
import type { CrossTabResult, CrossTabCell } from '@medicore/contracts';
import { CrossTabVO } from '@/domain/research/value-objects/cross-tab.vo';

export interface CrossTabPair {
  rowValue: string | null;
  colValue: string | null;
}

@Injectable()
export class CrossTabService {
  /**
   * Build the contingency table from extracted (rowValue, colValue) pairs.
   * `null` values are bucketed under "(missing)".
   */
  compute(
    pairs: CrossTabPair[],
    rowField: string,
    colField: string,
  ): CrossTabResult {
    const rows = this.uniqueLabels(pairs.map((p) => p.rowValue));
    const cols = this.uniqueLabels(pairs.map((p) => p.colValue));

    // Raw counts
    const cells: number[][] = rows.map(() => cols.map(() => 0));
    const rowIndex = new Map(rows.map((r, i) => [r, i]));
    const colIndex = new Map(cols.map((c, j) => [c, j]));
    for (const p of pairs) {
      const r = p.rowValue ?? '(missing)';
      const c = p.colValue ?? '(missing)';
      const i = rowIndex.get(r);
      const j = colIndex.get(c);
      if (i !== undefined && j !== undefined) cells[i][j]++;
    }

    const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
    const colTotals = cols.map((_, j) => cells.reduce((sum, row) => sum + row[j], 0));
    const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

    // Expected counts for chi-square
    const expected: number[][] =
      grandTotal > 0
        ? cells.map((_, i) => cols.map((_, j) => (rowTotals[i] * colTotals[j]) / grandTotal))
        : cells.map((row) => row.map(() => 0));

    const anyExpectedLt5 = expected.some((row) => row.some((e) => e < 5));
    const is2x2 = rows.length === 2 && cols.length === 2;

    let chiSquare: number | null = null;
    let chiSquareP: number | null = null;
    let fisherExactP: number | null = null;
    const warnings: string[] = [];

    if (grandTotal === 0) {
      warnings.push('empty_cohort');
    } else if (is2x2 && anyExpectedLt5) {
      // Fisher exact auto-fallback (spec §2)
      fisherExactP = this.fisherExact2x2(cells);
      warnings.push('fisher_fallback_expected_lt_5');
    } else {
      chiSquare = this.chiSquareStatistic(cells, expected);
      const df = Math.max(0, (rows.length - 1) * (cols.length - 1));
      chiSquareP = this.chiSquarePValue(chiSquare, df);
      if (anyExpectedLt5) {
        warnings.push('some_expected_lt_5_chi_square_approx');
      }
    }

    // Odds ratio + CI95 (Woolf) — only meaningful for 2×2
    let oddsRatio: number | null = null;
    let oddsRatioCi95: [number, number] | null = null;
    if (is2x2) {
      const a = cells[0][0];
      const b = cells[0][1];
      const c = cells[1][0];
      const d = cells[1][1];
      if (b > 0 && c > 0) {
        oddsRatio = (a * d) / (b * c);
        const logOR = Math.log(oddsRatio);
        const se = Math.sqrt(1 / Math.max(a, 0.5) + 1 / Math.max(b, 0.5) + 1 / Math.max(c, 0.5) + 1 / Math.max(d, 0.5));
        oddsRatioCi95 = [
          Math.exp(logOR - 1.96 * se),
          Math.exp(logOR + 1.96 * se),
        ];
      }
    }

    // BR-RES-004 suppression on the emitted cells
    const suppressedCells: CrossTabCell[][] = CrossTabVO.suppress(
      cells.map((row) => row.map((count) => ({ count, suppressed: false }))),
    );

    const vo = CrossTabVO.create({
      rowField,
      colField,
      rows,
      cols,
      cells: suppressedCells,
      rowTotals,
      colTotals,
      grandTotal,
      chiSquare,
      chiSquareP,
      fisherExactP,
      oddsRatio,
      oddsRatioCi95,
      warnings,
    });

    return vo.toDTO();
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private uniqueLabels(values: Array<string | null>): string[] {
    const set = new Set(values.map((v) => (v === null || v === undefined || v === '' ? '(missing)' : String(v))));
    return Array.from(set).sort();
  }

  private chiSquareStatistic(observed: number[][], expected: number[][]): number {
    let chi = 0;
    for (let i = 0; i < observed.length; i++) {
      for (let j = 0; j < observed[i].length; j++) {
        const e = expected[i][j];
        if (e > 0) chi += Math.pow(observed[i][j] - e, 2) / e;
      }
    }
    return Math.round(chi * 1e6) / 1e6;
  }

  /**
   * Fisher exact test 2×2 (two-sided). Uses the classic hypergeometric sum
   * over all tables with the same marginals, more extreme than observed.
   */
  private fisherExact2x2(cells: number[][]): number {
    const a = cells[0][0];
    const b = cells[0][1];
    const c = cells[1][0];
    const d = cells[1][1];
    const n = a + b + c + d;
    const row1 = a + b;
    const col1 = a + c;

    const logFact = this.makeLogFactorial(n);
    const logHyper = (aa: number) =>
      logFact[aa] +
      logFact[row1 - aa] +
      logFact[col1 - aa] +
      logFact[n - row1 - col1 + aa] -
      (logFact[row1] + logFact[col1] + logFact[n - row1] + logFact[n - col1] + logFact[0] + logFact[0]);

    const limit = Math.max(0, row1 + col1 - n);
    const minA = Math.max(0, row1 - (n - col1), col1 - (n - row1));
    const maxA = Math.min(row1, col1);

    const obsLogP = logHyper(a);
    void limit;
    let twoSided = 0;
    for (let aa = minA; aa <= maxA; aa++) {
      const lp = logHyper(aa);
      // two-sided: include tables with prob <= observed
      if (lp <= obsLogP + 1e-12) twoSided += Math.exp(lp);
    }
    return Math.min(1, Math.round(twoSided * 1e6) / 1e6);
  }

  private makeLogFactorial(maxN: number): number[] {
    const table = new Array(maxN + 1).fill(0);
    for (let i = 1; i <= maxN; i++) table[i] = table[i - 1] + Math.log(i);
    return table;
  }

  /**
   * Chi-square p-value via the upper incomplete gamma function (regularized Q).
   * df must be > 0. Uses the series + continued-fraction approximation
   * (Numerical Recipes). Avoids a stats dependency.
   */
  private chiSquarePValue(chiSquare: number, df: number): number {
    if (df <= 0) return 1;
    if (chiSquare <= 0) return 1;
    const x = chiSquare / 2;
    const a = df / 2;
    return this.regularizedUpperIncompleteGamma(a, x);
  }

  private regularizedUpperIncompleteGamma(a: number, x: number): number {
    // Q(a,x) = 1 - P(a,x)
    if (x < a + 1) {
      // series for P(a,x)
      return 1 - this.lowerGammaSeries(a, x);
    }
    // continued fraction for Q(a,x)
    return this.upperGammaContinuedFraction(a, x);
  }

  private lowerGammaSeries(a: number, x: number): number {
    let term = 1 / a;
    let sum = term;
    let n = 1;
    while (n < 1000) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
      n++;
    }
    return sum * Math.exp(-x + a * Math.log(x) - this.logGamma(a));
  }

  private upperGammaContinuedFraction(a: number, x: number): number {
    const tiny = 1e-30;
    let b = x + 1 - a;
    let c = 1 / tiny;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < tiny) d = tiny;
      c = b + an / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - this.logGamma(a)) * h;
  }

  private logGamma(x: number): number {
    // Lanczos approximation
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (x < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * x)) - this.logGamma(1 - x);
    }
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
}