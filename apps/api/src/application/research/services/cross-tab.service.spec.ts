// apps/api/src/application/research/services/cross-tab.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { CrossTabService } from './cross-tab.service';

const svc = new CrossTabService();

describe('CrossTabService', () => {
  it('builds a Sex × Diagnosis contingency table with counts + totals', () => {
    const pairs = [
      { rowValue: 'M', colValue: 'OA' },
      { rowValue: 'M', colValue: 'OA' },
      { rowValue: 'M', colValue: 'RA' },
      { rowValue: 'F', colValue: 'OA' },
      { rowValue: 'F', colValue: 'OA' },
      { rowValue: 'F', colValue: 'RA' },
    ];
    const r = svc.compute(pairs, 'sex', 'diagnosis');
    expect(r.rowField).toBe('sex');
    expect(r.colField).toBe('diagnosis');
    expect(r.rows.sort()).toEqual(['F', 'M']);
    expect(r.cols.sort()).toEqual(['OA', 'RA']);
    expect(r.grandTotal).toBe(6);
    expect(r.rowTotals.sort()).toEqual([3, 3]);
  });

  it('falls back to Fisher exact when any expected cell < 5 (2×2)', () => {
    // 2×2 with small expected counts — triggers Fisher fallback.
    const pairs = [
      { rowValue: 'M', colValue: 'A' },
      { rowValue: 'M', colValue: 'B' },
      { rowValue: 'M', colValue: 'B' },
      { rowValue: 'F', colValue: 'A' },
    ];
    const r = svc.compute(pairs, 'sex', 'group');
    expect(r.fisherExactP).not.toBeNull();
    expect(r.chiSquare).toBeNull();
    expect(r.warnings).toContain('fisher_fallback_expected_lt_5');
  });

  it('uses chi-square when expected counts are large', () => {
    const pairs: Array<{ rowValue: string; colValue: string }> = [];
    for (let i = 0; i < 30; i++) pairs.push({ rowValue: 'M', colValue: 'X' });
    for (let i = 0; i < 30; i++) pairs.push({ rowValue: 'M', colValue: 'Y' });
    for (let i = 0; i < 30; i++) pairs.push({ rowValue: 'F', colValue: 'X' });
    for (let i = 0; i < 30; i++) pairs.push({ rowValue: 'F', colValue: 'Y' });
    const r = svc.compute(pairs, 'sex', 'group');
    expect(r.chiSquare).not.toBeNull();
    // uniform marginals → chi-square ~ 0, p ~ 1
    expect(r.chiSquareP).toBeGreaterThan(0.95);
  });

  it('applies N<5 suppression (BR-RES-004) to small cells', () => {
    const pairs = [
      { rowValue: 'M', colValue: 'X' }, // single cell count 1 → suppressed
    ];
    const r = svc.compute(pairs, 'sex', 'group');
    const cell = r.cells[0][0];
    expect(cell.suppressed).toBe(true);
  });

  it('computes odds ratio + CI95 for 2×2 tables', () => {
    const pairs = [
      { rowValue: 'A', colValue: 'Y' }, { rowValue: 'A', colValue: 'Y' },
      { rowValue: 'A', colValue: 'Y' }, { rowValue: 'A', colValue: 'Z' },
      { rowValue: 'B', colValue: 'Y' }, { rowValue: 'B', colValue: 'Z' },
      { rowValue: 'B', colValue: 'Z' }, { rowValue: 'B', colValue: 'Z' },
    ];
    const r = svc.compute(pairs, 'g', 'outcome');
    expect(r.oddsRatio).not.toBeNull();
    expect(r.oddsRatioCi95).not.toBeNull();
  });

  it('emits empty_cohort warning for empty pairs', () => {
    const r = svc.compute([], 'sex', 'diag');
    expect(r.warnings).toContain('empty_cohort');
    expect(r.grandTotal).toBe(0);
  });
});