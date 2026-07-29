// apps/api/src/infrastructure/stats/stats.processor.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { StatsProcessor } from './stats.processor';
import { PythonStatsService } from './python-stats.service';
import { CircuitBreaker } from './circuit-breaker';
import type { StatisticalTestResult } from '@medicore/contracts';

function makeResult(): StatisticalTestResult {
  return {
    test: 'ttest_independent',
    statistic: 2.34,
    pValue: 0.021,
    ci95Lower: 0.4,
    ci95Upper: 6.1,
    effectSize: { name: 'cohen_d', value: 0.7, ci95Lower: 0.1, ci95Upper: 1.3 },
    degreesFreedom: 38,
    assumptionsChecked: ['normality'],
    warnings: [],
  };
}

describe('StatsProcessor', () => {
  it('returns the Python result on success', async () => {
    const python: Partial<PythonStatsService> = {
      runInferential: jest.fn(async () => makeResult()),
    };
    const breaker = new CircuitBreaker();
    const proc = new StatsProcessor(python as PythonStatsService);
    const out = await proc.handle({ data: { test: 'ttest_independent', input: {} } } as any);
    expect(out.ok).toBe(true);
    expect(out.result?.pValue).toBe(0.021);
    void breaker;
  });

  it('degrades gracefully with a warning when Python throws (BR-RES-005)', async () => {
    const python: Partial<PythonStatsService> = {
      runInferential: jest.fn(async () => {
        throw new Error('stats_service_http_500');
      }),
    };
    const proc = new StatsProcessor(python as PythonStatsService);
    const out = await proc.handle({ data: { test: 'fisher_exact', input: {} } } as any);
    expect(out.ok).toBe(false);
    expect(out.warning).toBe('inferential_stats_unavailable');
    // never throws — caller gets a warning envelope, not a failed job storm
    expect(out.result).toBeUndefined();
  });
});