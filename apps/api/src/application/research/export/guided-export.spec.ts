// apps/api/src/application/research/export/guided-export.spec.ts
// Tests for guided analysis exports: text, PDF, and V3 handler integration.

import { describe, it, expect } from '@jest/globals';
import { generateGuidedText } from './guided-text.generator';
import { GuidedPdfGenerator, SimplePdfRenderer } from './guided-pdf.generator';
import type { GuidedAnalysisResult } from '@medicore/contracts';

function buildMockResult(overrides?: Partial<GuidedAnalysisResult>): GuidedAnalysisResult {
  return {
    runId: 'run-1',
    cohort: { queryId: 'q-1', n: 100, filters: [] },
    path: 'inferential',
    summaries: [],
    results: [{
      test: 'ttest_independent',
      statistic: 2.5,
      pValue: 0.015,
      effectMeasures: [{
        name: 'relative_risk',
        value: 1.8,
        ci95Lower: 1.1,
        ci95Upper: 2.9,
        suppressed: false,
      }],
      groups: [{ key: 'Exposed', n: 50 }, { key: 'Unexposed', n: 50 }],
      warnings: [],
    }],
    rationale: ['Two independent groups with normally distributed data → Welch t-test.'],
    corrections: [],
    warnings: [],
    ...overrides,
  };
}

describe('Guided text export', () => {
  it('generates text with cohort context', () => {
    const result = buildMockResult();
    const text = generateGuidedText({ result });

    expect(text).toContain('query q-1');
    expect(text).toContain('n=100');
    expect(text).toContain('inferential');
  });

  it('includes rationale', () => {
    const result = buildMockResult();
    const text = generateGuidedText({ result });

    expect(text).toContain('Welch t-test');
  });

  it('includes inferential results', () => {
    const result = buildMockResult();
    const text = generateGuidedText({ result });

    expect(text).toContain('ttest_independent');
    expect(text).toContain('0.0150');
  });

  it('includes effect measures with CI', () => {
    const result = buildMockResult();
    const text = generateGuidedText({ result });

    expect(text).toContain('relative_risk');
    expect(text).toContain('1.800');
    expect(text).toContain('95% CI');
  });

  it('handles suppressed effect measures', () => {
    const result = buildMockResult({
      results: [{
        test: 'chi_square',
        statistic: null,
        pValue: null,
        effectMeasures: [{
          name: 'relative_risk',
          value: null,
          ci95Lower: null,
          ci95Upper: null,
          suppressed: true,
          suppressReason: 'zero_cell',
        }],
        groups: [],
        warnings: [],
      }],
    });
    const text = generateGuidedText({ result });

    expect(text).toContain('SUPPRESSED');
    expect(text).toContain('zero_cell');
  });

  it('includes warnings', () => {
    const result = buildMockResult({
      warnings: [{
        code: 'normality_violated',
        message: 'Data may not be normal.',
        suggestion: 'Consider non-parametric test.',
      }],
    });
    const text = generateGuidedText({ result });

    expect(text).toContain('normality_violated');
    expect(text).toContain('non-parametric');
  });

  it('includes corrections when present', () => {
    const result = buildMockResult({
      corrections: [{
        method: 'holm',
        adjustedP: 0.03,
        originalP: 0.015,
        label: 'adjusted via HOLM',
      }],
    });
    const text = generateGuidedText({ result });

    expect(text).toContain('HOLM');
    expect(text).toContain('0.0300');
  });

  it('includes descriptive summaries', () => {
    const result = buildMockResult({
      path: 'descriptive',
      summaries: [{
        variable: 'age',
        kind: 'quantitative',
        n: 100,
        missing: 2,
        mean: 45.3,
        sd: 12.1,
        median: 44,
        q1: 36,
        q3: 55,
        min: 18,
        max: 85,
        categories: [],
        suppressed: false,
      }],
      results: [],
    });
    const text = generateGuidedText({ result });

    expect(text).toContain('age');
    expect(text).toContain('quantitative');
    expect(text).toContain('Mean=45.3');
  });

  it('includes the p-value disclaimer', () => {
    const result = buildMockResult();
    const text = generateGuidedText({ result });

    expect(text).toContain('p-values are presented as a convention');
    expect(text).toContain('not as a standalone');
  });
});

describe('Guided PDF export', () => {
  it('generates a PDF buffer', async () => {
    const generator = new GuidedPdfGenerator(new SimplePdfRenderer());
    const result = buildMockResult();
    const buffer = await generator.generate({ result });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF header check
    expect(buffer.toString('utf-8')).toContain('%PDF');
  });

  it('uses custom title when provided', async () => {
    const generator = new GuidedPdfGenerator(new SimplePdfRenderer());
    const result = buildMockResult();
    const buffer = await generator.generate({ result, title: 'Custom Title' });

    expect(buffer.toString('utf-8')).toContain('Custom Title');
  });
});
