// apps/api/src/application/research/services/test-selection.policy.spec.ts
// Table tests for the automatic test-selection policy (design AD-3).
// The policy selects a method from group count, pairing, normality, and cell
// adequacy — and produces a clinician-readable rationale.

import { describe, it, expect } from '@jest/globals';
import { TestSelectionPolicy, type TestSelectionInput } from './test-selection.policy';

const policy = new TestSelectionPolicy();

describe('TestSelectionPolicy', () => {
  // ─────────────────────────────────────────────
  // Two-group independent
  // ─────────────────────────────────────────────

  it.each([
    {
      label: '2-group + normal → Welch t-test',
      input: { groupCount: 2, paired: false, isNormal: true, isBinary: false } as TestSelectionInput,
      expectedTest: 'ttest_independent',
      expectedRationale: /welch|t-test/i,
    },
    {
      label: '2-group + non-normal → Mann-Whitney',
      input: { groupCount: 2, paired: false, isNormal: false, isBinary: false } as TestSelectionInput,
      expectedTest: 'mannwhitney',
      expectedRationale: /mann-whitney|non-parametric/i,
    },
    {
      label: '2-group + binary → chi-square / Fisher',
      input: { groupCount: 2, paired: false, isNormal: true, isBinary: true } as TestSelectionInput,
      expectedTest: 'chi_square',
      expectedRationale: /chi-square|categorical/i,
    },
  ])('$label', ({ input, expectedTest, expectedRationale }) => {
    const result = policy.select(input);
    expect(result.test).toBe(expectedTest);
    expect(result.rationale).toMatch(expectedRationale);
    expect(result.warnings).toEqual([]);
  });

  // ─────────────────────────────────────────────
  // Multi-group (>2)
  // ─────────────────────────────────────────────

  it.each([
    {
      label: '>2-group + normal → one-way ANOVA',
      input: { groupCount: 3, paired: false, isNormal: true, isBinary: false } as TestSelectionInput,
      expectedTest: 'anova_oneway',
      expectedRationale: /anova|normal/i,
    },
    {
      label: '>2-group + non-normal → Kruskal-Wallis',
      input: { groupCount: 4, paired: false, isNormal: false, isBinary: false } as TestSelectionInput,
      expectedTest: 'kruskalwallis',
      expectedRationale: /kruskal|non-parametric/i,
    },
  ])('$label', ({ input, expectedTest, expectedRationale }) => {
    const result = policy.select(input);
    expect(result.test).toBe(expectedTest);
    expect(result.rationale).toMatch(expectedRationale);
  });

  // ─────────────────────────────────────────────
  // Paired
  // ─────────────────────────────────────────────

  it.each([
    {
      label: 'paired + normal → paired t-test',
      input: { groupCount: 2, paired: true, isNormal: true, isBinary: false } as TestSelectionInput,
      expectedTest: 'ttest_paired',
      expectedRationale: /paired/i,
    },
    {
      label: 'paired + non-normal → Wilcoxon',
      input: { groupCount: 2, paired: true, isNormal: false, isBinary: false } as TestSelectionInput,
      expectedTest: 'wilcoxon',
      expectedRationale: /wilcoxon|non-parametric/i,
    },
  ])('$label', ({ input, expectedTest, expectedRationale }) => {
    const result = policy.select(input);
    expect(result.test).toBe(expectedTest);
    expect(result.rationale).toMatch(expectedRationale);
  });

  // ─────────────────────────────────────────────
  // Invalid mapping → no unsafe comparison
  // ─────────────────────────────────────────────

  it('returns null test with warning for invalid group count (<2)', () => {
    const result = policy.select({ groupCount: 1, paired: false, isNormal: true, isBinary: false });
    expect(result.test).toBeNull();
    expect(result.rationale).toMatch(/cannot|invalid|insufficient/i);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns null test with warning for paired with >2 groups', () => {
    const result = policy.select({ groupCount: 3, paired: true, isNormal: true, isBinary: false });
    expect(result.test).toBeNull();
    expect(result.rationale).toMatch(/cannot|invalid|paired/i);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────
  // Rationale is always clinician-readable
  // ─────────────────────────────────────────────

  it('always produces a non-empty rationale string', () => {
    const inputs: TestSelectionInput[] = [
      { groupCount: 2, paired: false, isNormal: true, isBinary: false },
      { groupCount: 2, paired: false, isNormal: false, isBinary: false },
      { groupCount: 3, paired: false, isNormal: true, isBinary: false },
      { groupCount: 2, paired: true, isNormal: true, isBinary: false },
      { groupCount: 1, paired: false, isNormal: true, isBinary: false },
    ];
    for (const input of inputs) {
      const result = policy.select(input);
      expect(result.rationale).toBeTruthy();
      expect(typeof result.rationale).toBe('string');
    }
  });
});
