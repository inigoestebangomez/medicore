// apps/api/src/domain/research/value-objects/research-vos.spec.ts
import { describe, it, expect } from '@jest/globals';
import { StatisticalTestVO } from './statistical-test.vo';
import { CrossTabVO } from './cross-tab.vo';
import { SurvivalCurveVO } from './survival.vo';

describe('StatisticalTestVO', () => {
  it('constructs with valid props and flags significance', () => {
    const vo = StatisticalTestVO.create({
      test: 'ttest_independent',
      statistic: 2.5,
      pValue: 0.02,
      ci95Lower: 0.5,
      ci95Upper: 5.5,
      effectSize: { name: 'cohen_d', value: 0.8, ci95Lower: 0.1, ci95Upper: 1.5 },
      degreesFreedom: 38,
      assumptionsChecked: ['normality'],
      warnings: [],
    });
    expect(vo.isSignificantAt05).toBe(true);
  });

  it('rejects out-of-range p-value', () => {
    expect(() =>
      StatisticalTestVO.create({
        test: 'ttest_independent',
        statistic: 0,
        pValue: 1.5,
        ci95Lower: null,
        ci95Upper: null,
        effectSize: null,
        degreesFreedom: null,
        assumptionsChecked: [],
        warnings: [],
      }),
    ).toThrow();
  });

  it('rejects ci95Lower > ci95Upper', () => {
    expect(() =>
      StatisticalTestVO.create({
        test: 'pearson',
        statistic: 0.2,
        pValue: 0.5,
        ci95Lower: 5,
        ci95Upper: 1,
        effectSize: null,
        degreesFreedom: 10,
        assumptionsChecked: [],
        warnings: [],
      }),
    ).toThrow();
  });

  it('withWarning() appends immutably', () => {
    const vo = StatisticalTestVO.create({
      test: 'anova_oneway', statistic: 3.1, pValue: 0.04, ci95Lower: null, ci95Upper: null,
      effectSize: null, degreesFreedom: 2, assumptionsChecked: [], warnings: [],
    });
    const withWarn = vo.withWarning({ code: 'normality_violated', message: 'Shapiro p<0.05' });
    expect(withWarn.warnings.length).toBe(1);
    expect(vo.warnings.length).toBe(0);
  });
});

describe('CrossTabVO', () => {
  it('constructs a 2×2 and marks suppressed cells', () => {
    const cells = [
      [{ count: 1, suppressed: false }, { count: 10, suppressed: false }],
      [{ count: 8, suppressed: false }, { count: 12, suppressed: false }],
    ];
    const suppressed = CrossTabVO.suppress(cells);
    expect(suppressed[0][0].suppressed).toBe(true); // count 1 < 5
    expect(suppressed[0][1].suppressed).toBe(false); // count 10
  });

  it('rejects a cells matrix not matching rows×cols shape', () => {
    expect(() =>
      CrossTabVO.create({
        rowField: 'a', colField: 'b',
        rows: ['x', 'y'], cols: ['p', 'q'],
        cells: [[{ count: 1, suppressed: false }]], // wrong shape
        rowTotals: [1], colTotals: [1], grandTotal: 1,
        chiSquare: null, chiSquareP: null, fisherExactP: null,
        oddsRatio: null, oddsRatioCi95: null, warnings: [],
      }),
    ).toThrow();
  });
});

describe('SurvivalCurveVO', () => {
  it('constructs with parallel arrays', () => {
    const vo = SurvivalCurveVO.create({
      timePoints: [0, 1, 2],
      survival: [1, 0.8, 0.6],
      ciLower: [1, 0.7, 0.5],
      ciUpper: [1, 0.9, 0.7],
      riskTable: [],
      logRankP: 0.03,
      medianSurvival: 1.5,
      warnings: [],
    });
    expect(vo.isSignificantAt05).toBe(true);
  });

  it('rejects arrays of unequal length', () => {
    expect(() =>
      SurvivalCurveVO.create({
        timePoints: [0, 1],
        survival: [1],
        ciLower: [1], ciUpper: [1],
        riskTable: [], logRankP: null, medianSurvival: null, warnings: [],
      }),
    ).toThrow();
  });

  it('rejects survival probabilities outside [0,1]', () => {
    expect(() =>
      SurvivalCurveVO.create({
        timePoints: [0, 1], survival: [1, 1.5],
        ciLower: [1, 1], ciUpper: [1, 1],
        riskTable: [], logRankP: null, medianSurvival: null, warnings: [],
      }),
    ).toThrow();
  });
});