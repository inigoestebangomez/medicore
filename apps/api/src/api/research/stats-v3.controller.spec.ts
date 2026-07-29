// apps/api/src/api/research/stats-v3.controller.spec.ts
// Controller-level unit tests for the V3 stats endpoints (task 2.17). Guards
// are out of scope — the full DI graph is proven by app.module compilation.
// These cover handler delegation, body validation, and Python failure
// mapping (graceful degradation returns a warning envelope, never 5xx).

import { describe, it, expect, jest } from '@jest/globals';
import { StatsV3Controller } from './stats-v3.controller';
import type { JwtPayload } from '@medicore/contracts';

const user: JwtPayload = {
  sub: 'u-1',
  organizationId: 'org-1',
  email: 'a@b.c',
  role: 'PHYSICIAN',
} as unknown as JwtPayload;

// Helper: jest.fn() defaults ReturnType to `unknown`, and ResolveType<unknown>
// resolves to `never`, so mockResolvedValue(value) errors under strict typing.
// ByVal returns a Mock whose return type is the supplied value, so the
// contextual type of ResolveType lands on `T` and accepts the payload.
function byVal<T>(value: T) {
  const fn = jest.fn(() => Promise.resolve(value));
  return fn;
}

function build(stubs: { python?: any; tableOne?: any; tableOneCompare?: any; prePost?: any }) {
  return new StatsV3Controller(
    stubs.python ?? { runNormality: jest.fn() },
    stubs.tableOne ?? { execute: jest.fn() },
    stubs.tableOneCompare ?? { execute: jest.fn() },
    stubs.prePost ?? { execute: jest.fn() },
  );
}

describe('StatsV3Controller', () => {
  it('POST stats/normality rejects when values missing', async () => {
    const ctrl = build({});
    await expect(ctrl.normality({} as any)).rejects.toThrow();
  });

  it('POST stats/normality returns data on success', async () => {
    const python: any = { runNormality: byVal({ statistic: 0.9, pValue: 0.3, isNormal: true, n: 3, warnings: [] }) };
    const ctrl = build({ python });
    const res = await ctrl.normality({ values: [1, 2, 3] });
    expect(res.data.isNormal).toBe(true);
    expect(python.runNormality).toHaveBeenCalledWith([1, 2, 3], 0.05);
  });

  it('POST stats/normality degrades gracefully when Python fails', async () => {
    const python: any = { runNormality: jest.fn(() => Promise.reject(new Error('circuit open'))) };
    const ctrl = build({ python });
    const res = await ctrl.normality({ values: [1, 2, 3] });
    expect(res.data.isNormal).toBe(false);
    expect(res.data.warnings.length).toBeGreaterThan(0);
  });

  it('POST table1 delegates to TableOneHandler with organizationId from JWT', async () => {
    const tableOne: any = { execute: byVal({ queryId: 'q', totalN: 0, fields: [], warnings: [] }) };
    const ctrl = build({ tableOne });
    const res = await ctrl.table1({ studyId: 's1', fields: ['age'] }, user);
    expect(tableOne.execute).toHaveBeenCalledWith(expect.objectContaining({ studyId: 's1', organizationId: 'org-1', fields: ['age'] }));
    expect(res.data.totalN).toBe(0);
  });

  it('POST table1 rejects when fields missing', async () => {
    const ctrl = build({});
    await expect(ctrl.table1({} as any, user)).rejects.toThrow();
  });

  it('POST table1/compare rejects when groupBy missing', async () => {
    const ctrl = build({});
    await expect(ctrl.table1Compare({ fields: ['age'] } as any, user)).rejects.toThrow();
  });

  it('POST table1/compare delegates to TableOneCompareHandler', async () => {
    const compare: any = { execute: byVal({ queryId: 'q', totalN: 2, groupBy: 'sex', fields: [], warnings: [] }) };
    const ctrl = build({ tableOneCompare: compare });
    const res = await ctrl.table1Compare({ studyId: 's1', fields: ['age'], groupBy: 'sex' }, user);
    expect(compare.execute).toHaveBeenCalledWith(expect.objectContaining({ groupBy: 'sex' }));
    expect(res.data.groupBy).toBe('sex');
  });

  it('POST analysis/pre-post rejects when studyId missing', async () => {
    const ctrl = build({});
    await expect(ctrl.runPrePost({ scaleType: 'SNOT_22' } as any, user)).rejects.toThrow();
  });

  it('POST analysis/pre-post rejects when scaleType missing', async () => {
    const ctrl = build({});
    await expect(ctrl.runPrePost({ studyId: 's1' } as any, user)).rejects.toThrow();
  });

  it('POST analysis/pre-post delegates to PrePostAnalysisHandler', async () => {
    const prePost: any = { execute: byVal({ studyId: 's1', scaleType: 'SNOT_22', n: 5, pValue: '0.04', warnings: [] }) };
    const ctrl = build({ prePost });
    const res = await ctrl.runPrePost({ studyId: 's1', scaleType: 'SNOT_22', preWindowDays: 30 }, user);
    expect(prePost.execute).toHaveBeenCalledWith(expect.objectContaining({ studyId: 's1', organizationId: 'org-1', preWindowDays: 30 }));
    expect(res.data.n).toBe(5);
  });
});