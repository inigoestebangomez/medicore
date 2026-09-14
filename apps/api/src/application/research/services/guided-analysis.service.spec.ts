// apps/api/src/application/research/services/guided-analysis.service.spec.ts
// Unit tests for the descriptive path of GuidedAnalysisService.
// Covers: R2S1 (mixed variables), R2S2 (sparse/missing data suppression).

import { describe, it, expect, jest } from '@jest/globals';
import { GuidedAnalysisService } from './guided-analysis.service';
import { TestSelectionPolicy } from './test-selection.policy';
import { ExposureDomainResolver } from './exposure-domain.resolver';

// Helper: jest.fn() defaults ReturnType to `unknown`, ResolveType<unknown> → `never`.
function byVal<T>(value: T) {
  return jest.fn(() => Promise.resolve(value));
}

function buildService() {
  const queryRepo = {
    findById: jest.fn(),
  };
  const executeQuery = {
    execute: jest.fn(),
  };
  const pythonStats = {
    runNormality: jest.fn(),
    runInferential: jest.fn(),
    computeRelativeRisk: jest.fn(),
    adjustPValues: jest.fn(),
  };

  const service = new GuidedAnalysisService(
    queryRepo as any,
    executeQuery as any,
    new TestSelectionPolicy(),
    new ExposureDomainResolver(),
    pythonStats as any,
  );

  return { service, queryRepo, executeQuery, pythonStats };
}

describe('GuidedAnalysisService — descriptive path (R2S1, R2S2)', () => {
  it('summarizes mixed quantitative and qualitative variables (R2S1)', async () => {
    const { service, queryRepo, executeQuery } = buildService();

    queryRepo.findById = byVal({ id: 'q-1' }) as any;
    executeQuery.execute = byVal({
      totalRows: 10,
      appliedFilters: [],
      rows: [
        { fields: { age: 45, gender: 'M' } },
        { fields: { age: 50, gender: 'F' } },
        { fields: { age: 38, gender: 'M' } },
        { fields: { age: 55, gender: 'F' } },
        { fields: { age: 42, gender: 'M' } },
        { fields: { age: 60, gender: 'F' } },
        { fields: { age: 35, gender: 'M' } },
        { fields: { age: 48, gender: 'F' } },
        { fields: { age: 52, gender: 'M' } },
        { fields: { age: 41, gender: 'F' } },
      ],
    }) as any;

    const result = await service.execute(
      {
        queryId: '550e8400-e29b-41d4-a716-446655440000',
        path: 'descriptive',
        variables: ['age', 'gender'],
        alpha: 0.05,
      },
      'org-1',
    );

    expect(result.path).toBe('descriptive');
    expect(result.summaries).toHaveLength(2);

    // Quantitative variable
    const ageSummary = result.summaries.find((s) => s.variable === 'age');
    expect(ageSummary).toBeDefined();
    expect(ageSummary!.kind).toBe('quantitative');
    expect(ageSummary!.n).toBe(10);
    expect(ageSummary!.mean).toBeDefined();
    expect(ageSummary!.sd).toBeDefined();
    expect(ageSummary!.suppressed).toBe(false);

    // Qualitative variable
    const genderSummary = result.summaries.find((s) => s.variable === 'gender');
    expect(genderSummary).toBeDefined();
    expect(genderSummary!.kind).toBe('qualitative');
    expect(genderSummary!.categories.length).toBeGreaterThan(0);
    expect(genderSummary!.suppressed).toBe(false);
  });

  it('suppresses variables with insufficient data (n < 5) and emits warning (R2S2)', async () => {
    const { service, queryRepo, executeQuery } = buildService();

    queryRepo.findById = byVal({ id: 'q-1' }) as any;
    executeQuery.execute = byVal({
      totalRows: 3,
      appliedFilters: [],
      rows: [
        { fields: { rare_var: 10 } },
        { fields: { rare_var: 20 } },
        { fields: { rare_var: null } },
      ],
    }) as any;

    const result = await service.execute(
      {
        queryId: '550e8400-e29b-41d4-a716-446655440000',
        path: 'descriptive',
        variables: ['rare_var'],
        alpha: 0.05,
      },
      'org-1',
    );

    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0].suppressed).toBe(true);
    expect(result.summaries[0].suppressReason).toContain('n=');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe('insufficient_data');
  });

  it('handles all-missing data for a variable', async () => {
    const { service, queryRepo, executeQuery } = buildService();

    queryRepo.findById = byVal({ id: 'q-1' }) as any;
    executeQuery.execute = byVal({
      totalRows: 5,
      appliedFilters: [],
      rows: [
        { fields: { empty_var: null } },
        { fields: { empty_var: null } },
        { fields: { empty_var: null } },
        { fields: { empty_var: null } },
        { fields: { empty_var: null } },
      ],
    }) as any;

    const result = await service.execute(
      {
        queryId: '550e8400-e29b-41d4-a716-446655440000',
        path: 'descriptive',
        variables: ['empty_var'],
        alpha: 0.05,
      },
      'org-1',
    );

    expect(result.summaries[0].suppressed).toBe(true);
    expect(result.summaries[0].missing).toBe(5);
  });
});
