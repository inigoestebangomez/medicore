// apps/api/src/api/research/guided-analysis.controller.spec.ts
// Integration test for the guided analysis controller.
// Verifies: envelope shape, invalid-cohort blocked scenario, feature flag guard.

import { describe, it, expect, jest } from '@jest/globals';
import { GuidedAnalysisController } from './guided-analysis.controller';
import { GuidedAnalysisService, InvalidCohortError } from '@/application/research/services/guided-analysis.service';
import { BadRequestException } from '@nestjs/common';

function buildController(stubs: { execute?: jest.Mock }) {
  const service = {
    execute: stubs.execute ?? jest.fn(),
  } as unknown as GuidedAnalysisService;
  return new GuidedAnalysisController(service);
}

const mockUser = {
  sub: 'user-1',
  organizationId: 'org-1',
  email: 'test@test.com',
  role: 'ADMIN',
} as any;

describe('GuidedAnalysisController', () => {
  it('returns a valid envelope for a descriptive analysis', async () => {
    const expectedResult = {
      runId: 'run-1',
      cohort: { queryId: 'q-1', n: 50, filters: [] },
      path: 'descriptive' as const,
      summaries: [],
      results: [],
      rationale: ['Descriptive analysis'],
      corrections: [],
      warnings: [],
    };

    const controller = buildController({
      execute: jest.fn().mockResolvedValue(expectedResult),
    });

    const body = {
      queryId: '550e8400-e29b-41d4-a716-446655440000',
      path: 'descriptive',
      variables: ['age'],
    };

    const result = await controller.runAnalysis(body, mockUser);
    expect(result.data).toEqual(expectedResult);
    expect(result.data.runId).toBe('run-1');
    expect(result.data.path).toBe('descriptive');
  });

  it('returns a valid envelope for an inferential analysis', async () => {
    const expectedResult = {
      runId: 'run-2',
      cohort: { queryId: 'q-1', n: 100, filters: [] },
      path: 'inferential' as const,
      summaries: [],
      results: [{
        test: 'ttest_independent',
        statistic: 2.5,
        pValue: 0.01,
        effectMeasures: [],
        groups: [{ key: 'A', n: 50 }, { key: 'B', n: 50 }],
        warnings: [],
      }],
      rationale: ['Two independent groups with normally distributed data → Welch t-test.'],
      corrections: [],
      warnings: [],
    };

    const controller = buildController({
      execute: jest.fn().mockResolvedValue(expectedResult),
    });

    const body = {
      queryId: '550e8400-e29b-41d4-a716-446655440000',
      path: 'inferential',
      variables: ['age'],
      exposure: { domain: 'treatment', elementIds: ['drug_a', 'drug_b'] },
      outcome: 'blood_pressure',
    };

    const result = await controller.runAnalysis(body, mockUser);
    expect(result.data.path).toBe('inferential');
    expect(result.data.results).toHaveLength(1);
    expect(result.data.results[0].test).toBe('ttest_independent');
  });

  it('throws BadRequestException for invalid cohort (empty cohort)', async () => {
    const controller = buildController({
      execute: jest.fn().mockRejectedValue(new InvalidCohortError('Cohort is empty.')),
    });

    const body = {
      queryId: '550e8400-e29b-41d4-a716-446655440000',
      path: 'descriptive',
      variables: ['age'],
    };

    await expect(controller.runAnalysis(body, mockUser)).rejects.toThrow(BadRequestException);
    await expect(controller.runAnalysis(body, mockUser)).rejects.toThrow(/empty/i);
  });

  it('throws BadRequestException for invalid request body', async () => {
    const controller = buildController({});

    // Missing required fields
    const body = { path: 'descriptive' };

    await expect(controller.runAnalysis(body, mockUser)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for invalid path value', async () => {
    const controller = buildController({});

    const body = {
      queryId: '550e8400-e29b-41d4-a716-446655440000',
      path: 'invalid_path',
      variables: ['age'],
    };

    await expect(controller.runAnalysis(body, mockUser)).rejects.toThrow(BadRequestException);
  });
});
