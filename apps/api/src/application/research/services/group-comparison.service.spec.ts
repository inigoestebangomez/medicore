// apps/api/src/application/research/services/group-comparison.service.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { GroupComparisonService } from './group-comparison.service';

function byVal<T>(value: T) {
  return jest.fn(() => Promise.resolve(value));
}

function buildNoStudy(stubs: { executeQuery?: any; pythonStats?: any; studyRepo?: any }) {
  return new GroupComparisonService(
    stubs.studyRepo ?? { findById: jest.fn() },
    stubs.executeQuery ?? { execute: jest.fn() },
    stubs.pythonStats ?? {
      runNormality: jest.fn(),
      runInferential: jest.fn(),
    },
  );
}

// executeQuery returns ExecuteQueryResult.rows: {patientId, nhc, fields:{...}}.
// GroupComparisonService.toRawRows flattens `...r.fields`.
function row(id: string, fields: Record<string, unknown>) {
  return { patientId: id, nhc: `nhc-${id}`, fields } as any;
}

describe('GroupComparisonService', () => {
  it('warns when groupBy does not produce exactly 2 groups', async () => {
    const rows = [row('1', { sex: 'M', age: 30 }), row('2', { sex: 'F', age: 32 }), row('3', { sex: 'Other', age: 28 })];
    const executeQuery = { execute: byVal({ rows }) };
    const svc = buildNoStudy({ executeQuery, pythonStats: { runNormality: jest.fn(), runInferential: jest.fn() } });

    const res = await svc.compare({ queryId: 'q', organizationId: 'o', groupBy: 'sex', variableFields: ['age'] });
    expect(res.warnings.some((w) => /exactly 2 groups/.test(w))).toBe(true);
  });

  it('skips the test when a group has fewer than 5 patients', async () => {
    const rows = [
      row('1', { sex: 'M', age: 30 }), row('2', { sex: 'M', age: 31 }),
      row('3', { sex: 'F', age: 28 }), row('4', { sex: 'F', age: 29 }),
    ];
    const executeQuery = { execute: byVal({ rows }) };
    const pythonStats = { runNormality: jest.fn(), runInferential: jest.fn() };
    const svc = buildNoStudy({ executeQuery, pythonStats });

    const res = await svc.compare({ queryId: 'q', organizationId: 'o', groupBy: 'sex', variableFields: ['age'] });
    const v = res.variables[0];
    expect(v.test).toBeNull();
    expect(v.pValue).toBe('—');
    expect(v.warnings.some((w) => /n<5/.test(w))).toBe(true);
  });

  it('uses t-test when normality passes and n≥5 per group', async () => {
    const m = Array.from({ length: 6 }, (_, i) => row(`m${i}`, { sex: 'M', age: 30 + i }));
    const f = Array.from({ length: 6 }, (_, i) => row(`f${i}`, { sex: 'F', age: 25 + i }));
    const rows = [...m, ...f];
    const executeQuery = { execute: byVal({ rows }) };
    const pythonStats = {
      runNormality: byVal({ statistic: 0.95, pValue: 0.4, isNormal: true, n: 12, warnings: [] }),
      runInferential: byVal({ statistic: 2.1, pValue: 0.05, effectSize: null, ci95Lower: null, ci95Upper: null, warnings: [] }),
    };
    const svc = buildNoStudy({ executeQuery, pythonStats });

    const res = await svc.compare({ queryId: 'q', organizationId: 'o', groupBy: 'sex', variableFields: ['age'] });
    const v = res.variables[0];
    expect(v.test).toBe('ttest_independent');
    expect(v.pValue).toBe('0.050');
    expect(v.groups.every((g) => g.representation === 'mean_sd')).toBe(true);
  });

  it('uses Mann-Whitney when normality fails', async () => {
    const m = Array.from({ length: 6 }, (_, i) => row(`m${i}`, { sex: 'M', age: 30 + i * 3 }));
    const f = Array.from({ length: 6 }, (_, i) => row(`f${i}`, { sex: 'F', age: 25 + i }));
    const rows = [...m, ...f];
    const executeQuery = { execute: byVal({ rows }) };
    const pythonStats = {
      runNormality: byVal({ statistic: 0.6, pValue: 0.001, isNormal: false, n: 12, warnings: [] }),
      runInferential: byVal({ statistic: 18, pValue: 0.02, effectSize: null, ci95Lower: null, ci95Upper: null, warnings: [] }),
    };
    const svc = buildNoStudy({ executeQuery, pythonStats });

    const res = await svc.compare({ queryId: 'q', organizationId: 'o', groupBy: 'sex', variableFields: ['age'] });
    expect(res.variables[0].test).toBe('mannwhitney');
    expect(res.variables[0].groups.every((g) => g.representation === 'median_iqr')).toBe(true);
  });

  it('uses Fisher exact for categorical with low expected counts', async () => {
    const rows = [
      row('1', { sex: 'M', smoker: 'yes' }), row('2', { sex: 'M', smoker: 'no' }),
      row('3', { sex: 'F', smoker: 'yes' }), row('4', { sex: 'F', smoker: 'no' }),
    ];
    const executeQuery = { execute: byVal({ rows }) };
    const pythonStats = {
      runNormality: jest.fn(),
      runInferential: byVal({ statistic: 0.3, pValue: 1, effectSize: null, ci95Lower: null, ci95Upper: null, warnings: [] }),
    };
    const svc = buildNoStudy({ executeQuery, pythonStats });

    const res = await svc.compare({ queryId: 'q', organizationId: 'o', groupBy: 'sex', variableFields: ['smoker'] });
    const v = res.variables[0];
    expect(v.test).toBe('fisher_exact');
    expect(v.groups.every((g) => g.representation === 'categorical')).toBe(true);
  });

  it('degrades when the inferential test throws (never 5xx)', async () => {
    const m = Array.from({ length: 6 }, (_, i) => row(`m${i}`, { sex: 'M', age: 30 + i }));
    const f = Array.from({ length: 6 }, (_, i) => row(`f${i}`, { sex: 'F', age: 25 + i }));
    const rows = [...m, ...f];
    const executeQuery = { execute: byVal({ rows }) };
    const pythonStats = {
      runNormality: byVal({ statistic: 0.95, pValue: 0.4, isNormal: true, n: 12, warnings: [] }),
      runInferential: jest.fn(() => Promise.reject(new Error('circuit open'))),
    };
    const svc = buildNoStudy({ executeQuery, pythonStats });

    const res = await svc.compare({ queryId: 'q', organizationId: 'o', groupBy: 'sex', variableFields: ['age'] });
    expect(res.variables[0].test).toBe('ttest_independent');
    expect(res.variables[0].pValue).toBe('—');
    expect(res.variables[0].warnings.some((w) => /test_unavailable/.test(w))).toBe(true);
  });

  it('resolves via studyId and throws when study missing', async () => {
    const studyRepo = { findById: jest.fn(async () => null) };
    const svc = buildNoStudy({ studyRepo });
    await expect(svc.compare({ studyId: 's1', organizationId: 'o', groupBy: 'sex', variableFields: ['age'] })).rejects.toThrow();
  });
});