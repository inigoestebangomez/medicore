// apps/api/src/application/research/export/r-syntax.generator.spec.ts
import { describe, it, expect } from '@jest/globals';
import { generateRSyntax } from './r-syntax.generator';

describe('generateRSyntax', () => {
  it('emits a header and maps each test to the canonical R call', () => {
    const out = generateRSyntax({
      studyName: 'My Study',
      tests: [
        { test: 'ttest_independent', group1: 'grp_A', group2: 'grp_B' },
        { test: 'mannwhitney', group1: 'a-b', group2: 'c_d' },
        { test: 'chi_square', group1: 'sex', group2: 'group' },
        { test: 'fisher_exact', group1: 'sex', group2: 'smoker' },
        { test: 'pearson', xField: 'age', yField: 'score' },
        { test: 'spearman', xField: 'age', yField: 'score' },
        { test: 'linear_regression', xField: 'age', yField: 'score' },
        { test: 'logistic_regression', xField: 'age', yField: 'event' },
        { test: 'kaplan_meier', timeField: 'follow', eventField: 'event' },
      ],
    });

    expect(out).toContain('library("survival")');
    expect(out).toContain('Study: My Study');
    expect(out).toContain('t.test(grp_A, grp_B, var.equal = FALSE)');
    expect(out).toContain('wilcox.test(a_b, c_d)');       // hyphen sanitized to _
    expect(out).toContain('chisq.test(observed_matrix)');
    expect(out).toContain('fisher.test(observed_matrix)');
    expect(out).toContain('cor.test(age, score, method = "pearson")');
    expect(out).toContain('cor.test(age, score, method = "spearman")');
    expect(out).toContain('lm(score ~ age, data = df)');
    expect(out).toContain('glm(event ~ age, data = df, family = binomial(link = "logit"))');
    expect(out).toContain('survfit(Surv(follow, event)');
    expect(out).toContain('survdiff(Surv(follow, event)');
  });

  it('respects var.equal=true for the t-test', () => {
    const out = generateRSyntax({ tests: [{ test: 'ttest_independent', group1: 'a', group2: 'b', varEqual: true }] });
    expect(out).toContain('t.test(a, b, var.equal = TRUE)');
  });

  it('handles missing study name gracefully', () => {
    const out = generateRSyntax({ tests: [] });
    expect(out).toContain('Study: (unnamed)');
  });
});