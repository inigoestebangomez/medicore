// apps/api/src/application/research/services/test-selection.policy.ts
// Single source of truth for automatic test selection in the guided analysis
// workflow (design AD-3). The UI renders the returned rationale — it MUST NOT
// make its own test decision. This prevents API/UI divergence.
//
// Decision tree:
//   paired=true + 2 groups + normal → ttest_paired
//   paired=true + 2 groups + non-normal → wilcoxon
//   paired=true + >2 groups → INVALID (warning)
//   paired=false + 2 groups + binary → chi_square (Fisher on low expected)
//   paired=false + 2 groups + continuous + normal → ttest_independent
//   paired=false + 2 groups + continuous + non-normal → mannwhitney
//   paired=false + >2 groups + normal → anova_oneway
//   paired=false + >2 groups + non-normal → kruskalwallis
//   groupCount < 2 → INVALID (warning)

import { Injectable } from '@nestjs/common';

export interface TestSelectionInput {
  groupCount: number;
  paired: boolean;
  isNormal: boolean;
  isBinary: boolean;
}

export interface TestSelectionResult {
  test: string | null;
  rationale: string;
  warnings: string[];
}

@Injectable()
export class TestSelectionPolicy {
  select(input: TestSelectionInput): TestSelectionResult {
    const { groupCount, paired, isNormal, isBinary } = input;

    // Guard: insufficient groups
    if (groupCount < 2) {
      return {
        test: null,
        rationale: 'Cannot perform comparison with fewer than 2 groups. At least two exposure elements are required.',
        warnings: ['insufficient_groups: need ≥2 groups for comparison'],
      };
    }

    // Guard: paired requires exactly 2 groups
    if (paired && groupCount > 2) {
      return {
        test: null,
        rationale: 'Paired comparison requires exactly 2 time points or conditions. Multi-group paired analysis is not supported.',
        warnings: ['invalid_paired_design: paired analysis requires exactly 2 groups'],
      };
    }

    // Paired tests (2 groups)
    if (paired && groupCount === 2) {
      if (isNormal) {
        return {
          test: 'ttest_paired',
          rationale: 'Paired design with normally distributed differences → paired t-test. This test compares the mean difference between paired observations.',
          warnings: [],
        };
      }
      return {
        test: 'wilcoxon',
        rationale: 'Paired design with non-normal distribution → Wilcoxon signed-rank test. This non-parametric alternative does not assume normality of differences.',
        warnings: [],
      };
    }

    // Two-group independent
    if (groupCount === 2) {
      if (isBinary) {
        return {
          test: 'chi_square',
          rationale: 'Binary outcome with two independent groups → chi-square test of independence. If expected cell counts are below 5, Fisher exact test will be used automatically.',
          warnings: [],
        };
      }
      if (isNormal) {
        return {
          test: 'ttest_independent',
          rationale: 'Two independent groups with normally distributed data → Welch t-test. Variance homogeneity is checked automatically; Welch correction is applied if variances differ.',
          warnings: [],
        };
      }
      return {
        test: 'mannwhitney',
        rationale: 'Two independent groups with non-normal distribution → Mann-Whitney U test. This non-parametric test compares rank distributions between groups.',
        warnings: [],
      };
    }

    // Multi-group (>2) independent
    if (isNormal) {
      return {
        test: 'anova_oneway',
        rationale: `${groupCount} independent groups with normally distributed data → one-way ANOVA. This tests whether at least one group mean differs from the others.`,
        warnings: [],
      };
    }
    return {
      test: 'kruskalwallis',
      rationale: `${groupCount} independent groups with non-normal distribution → Kruskal-Wallis test. This non-parametric alternative tests whether groups come from the same distribution.`,
      warnings: [],
    };
  }
}
