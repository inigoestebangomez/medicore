// apps/api/src/application/research/export/spss-syntax.generator.spec.ts
import { describe, it, expect } from '@jest/globals';
import { generateSpssSyntax } from './spss-syntax.generator';

describe('generateSpssSyntax', () => {
  it('maps each test to the canonical SPSS command', () => {
    const out = generateSpssSyntax({
      studyName: 'Estudio',
      tests: [
        { test: 'ttest_independent', group1: 'group', group2: 'age' },
        { test: 'mannwhitney', group1: 'group', xField: 'age' },
        { test: 'chi_square', group1: 'sex', group2: 'smoker' },
        { test: 'fisher_exact', group1: 'sex', group2: 'smoker' },
        { test: 'pearson', xField: 'age', yField: 'score' },
        { test: 'linear_regression', xField: 'age', yField: 'score' },
        { test: 'logistic_regression', xField: 'age', yField: 'event' },
        { test: 'kaplan_meier', timeField: 'follow', eventField: 'event' },
      ],
    });

    expect(out).toContain('Study: Estudio');
    expect(out).toContain('T-TEST GROUPS=group(0 1)');
    expect(out).toContain('NPAR TESTS /MANN-WHITNEY=age BY group(0 1)');
    expect(out).toContain('CROSSTABS TABLES=sex BY smoker /STATISTICS=CHISQ.');
    expect(out).toContain('CORRELATIONS /VARIABLES=age, score');
    expect(out).toContain('REGRESSION /DEPENDENT=score /METHOD=ENTER age.');
    expect(out).toContain('LOGISTIC REGRESSION VARIABLES=event /METHOD=ENTER age.');
    expect(out).toContain('KM follow BY event');
  });
});