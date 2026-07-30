// apps/api/src/application/research/services/survival-table.service.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { SurvivalTableService } from './survival-table.service';
import type { SurvivalResult } from '@medicore/contracts';

const KM: SurvivalResult = {
  timePoints: [0, 6, 12, 18, 24, 30, 36],
  survival: [1, 0.95, 0.88, 0.8, 0.72, 0.6, 0.5],
  ciLower: [1, 0.9, 0.82, 0.72, 0.62, 0.5, 0.4],
  ciUpper: [1, 1, 0.94, 0.88, 0.82, 0.7, 0.6],
  riskTable: [],
  logRankP: 0.01,
  medianSurvival: 30,
  warnings: [],
};

function byVal<T>(value: T) {
  return jest.fn(() => Promise.resolve(value));
}

function build(stubs: { studyRepo?: any; executeQuery?: any; pythonStats?: any }) {
  return new SurvivalTableService(
    stubs.studyRepo ?? { findById: jest.fn() },
    stubs.executeQuery ?? { execute: jest.fn() },
    stubs.pythonStats ?? { computeSurvival: byVal(KM) },
  );
}

describe('SurvivalTableService', () => {
  it('requires studyId or queryId', async () => {
    const svc = build({ executeQuery: { execute: jest.fn() } });
    await expect(svc.generate({ organizationId: 'o', timeField: 't', eventField: 'e' } as any)).rejects.toThrow();
  });

  it('throws StudyNotFoundError when study missing', async () => {
    const studyRepo = { findById: jest.fn(async () => null) };
    const svc = build({ studyRepo });
    await expect(svc.generate({ studyId: 's1', organizationId: 'o', timeField: 't', eventField: 'e' })).rejects.toThrow(/s1/);
  });

  it('samples survival at 6/12/18/24/36 months and produces CSV', async () => {
    const executeQuery = { execute: byVal({ rows: [
      { patientId: 'p1', nhc: 'n1', fields: { t: 36, e: 0 } },
      { patientId: 'p2', nhc: 'n2', fields: { t: 12, e: 1 } },
    ] }) };
    const studyRepo = { findById: byVal({ queryId: 'q1' }) };
    const pythonStats = { computeSurvival: byVal(KM) };
    const svc = build({ studyRepo, executeQuery, pythonStats });

    const res = await svc.generate({
      studyId: 's1', organizationId: 'o', timeField: 't', eventField: 'e',
    });

    expect(res.queryId).toBe('q1');
    expect(res.n).toBe(2);
    expect(res.rows.map((r) => r.months)).toEqual([6, 12, 18, 24, 36]);
    expect(res.rows[0].survival).toBeCloseTo(0.95, 2);
    expect(res.medianSurvival).toBe(30);
    // CSV header + 5 rows + footer comment.
    expect(res.csv.split('\n')[0]).toBe('months,survival,ci_lower,ci_upper');
    expect(res.csv).toContain('# n=2');
  });

  it('degrades gracefully when Python survival fails', async () => {
    const executeQuery = { execute: byVal({ rows: [{ patientId: 'p1', nhc: 'n1', fields: { t: 6, e: 1 } }] }) };
    const studyRepo = { findById: byVal({ queryId: 'q1' }) };
    const pythonStats = { computeSurvival: jest.fn(() => Promise.reject(new Error('circuit open'))) };
    const svc = build({ studyRepo, executeQuery, pythonStats });

    const res = await svc.generate({ studyId: 's1', organizationId: 'o', timeField: 't', eventField: 'e' });
    expect(res.n).toBe(1);
    expect(res.medianSurvival).toBeNull();
    expect(res.warnings.some((w) => w.includes('survival_unavailable'))).toBe(true);
    expect(res.rows.every((r) => r.survival === null)).toBe(true);
  });

  it('reports empty when no valid time observations', async () => {
    const executeQuery = { execute: byVal({ rows: [{ patientId: 'p1', nhc: 'n1', fields: { t: 'n/a', e: 1 } }] }) };
    const studyRepo = { findById: byVal({ queryId: 'q1' }) };
    const svc = build({ studyRepo, executeQuery });

    const res = await svc.generate({ studyId: 's1', organizationId: 'o', timeField: 't', eventField: 'e' });
    expect(res.n).toBe(0);
    expect(res.warnings.some((w) => w.includes('no valid time'))).toBe(true);
  });
});