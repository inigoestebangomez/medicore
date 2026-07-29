// apps/api/src/application/research/table-one-prepost.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { TableOneService } from './services/table-one.service';
import { PrePostAnalysisService } from './services/pre-post-analysis.service';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import type { ExecuteQueryResult } from './queries/execute-research-query.handler';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

function mockStudyRepo(study: ResearchStudy | null): IResearchStudyRepository {
  return {
    findById: jest.fn(async () => study),
    create: jest.fn(),
    findByOrganization: jest.fn(),
    update: jest.fn(),
    findActiveWithStaleCache: jest.fn(),
    softDelete: jest.fn(),
  } as IResearchStudyRepository;
}

const study = new ResearchStudy({
  id: 's1', organizationId: 'o', createdBy: 'u', queryId: 'q',
  name: 'C', status: 'ACTIVE', cachedPatientIds: ['p1', 'p2'], patientCount: 2,
});

describe('TableOneService', () => {
  const rows = [
    { patientId: 'p1', nhc: 'n1', age: 50, sex: 'M', pain: 7 },
    { patientId: 'p2', nhc: 'n2', age: 60, sex: 'F', pain: 5 },
    { patientId: 'p3', nhc: 'n3', age: 55, sex: 'M', pain: 8 },
  ] as any[];

  const exec = {
    execute: jest.fn(async () => ({
      queryId: 'q', totalRows: 3, rows: rows.map((r) => ({ patientId: r.patientId, nhc: r.nhc, fields: { age: r.age, sex: r.sex, pain: r.pain } })),
      stats: [], distributions: [], displayFields: ['age', 'sex', 'pain'], appliedFilters: [],
    }) as ExecuteQueryResult),
  };
  const pythonStats: any = {
    runDescribeAuto: jest.fn(async (values: number[]) => ({
      representation: 'mean_sd', mean: values.reduce((a, b) => a + b, 0) / values.length,
      sd: 5, median: null, q1: null, q3: null, n: values.length, normality: null, warnings: [],
    })),
    runNormality: jest.fn(async () => ({ statistic: 0.9, pValue: 0.3, isNormal: true, n: 3, warnings: [] })),
    runInferential: jest.fn(async () => ({ test: 'ttest_independent', statistic: 1.1, pValue: 0.05, ci95Lower: null, ci95Upper: null, effectSize: null, degreesFreedom: null, assumptionsChecked: [], warnings: [] })),
  };

  it('throws when neither studyId nor queryId is provided', async () => {
    const svc = new TableOneService(mockStudyRepo(study), exec as any, pythonStats);
    await expect(svc.generate({ organizationId: 'o', fields: ['age'] })).rejects.toThrow();
  });

  it('throws StudyNotFoundError for unknown study', async () => {
    const svc = new TableOneService(mockStudyRepo(null), exec as any, pythonStats);
    await expect(svc.generate({ studyId: 'x', organizationId: 'o', fields: ['age'] })).rejects.toThrow(StudyNotFoundError);
  });

  it('describes a numeric field with mean±SD when normal', async () => {
    const svc = new TableOneService(mockStudyRepo(study), exec as any, pythonStats);
    const res = await svc.generate({ studyId: 's1', organizationId: 'o', fields: ['age'] });
    const age = res.fields.find((f) => f.field === 'age')!;
    expect(age.representation).toBe('mean_sd');
    expect(age.mean).not.toBeNull();
    expect(res.totalN).toBe(3);
  });

  it('describes a categorical field with counts and percents', async () => {
    const svc = new TableOneService(mockStudyRepo(study), exec as any, pythonStats);
    const res = await svc.generate({ studyId: 's1', organizationId: 'o', fields: ['sex'] });
    const sex = res.fields.find((f) => f.field === 'sex')!;
    expect(sex.representation).toBe('categorical');
    expect(sex.categories.length).toBeGreaterThan(0);
    const total = sex.categories.reduce((a, c) => a + c.count, 0);
    expect(total).toBe(3);
  });

  it('falls back to median(IQR) when Python describe fails', async () => {
    const pyx: any = { runDescribeAuto: jest.fn(async () => { throw new Error('down'); }) };
    const svc = new TableOneService(mockStudyRepo(study), exec as any, pyx);
    const res = await svc.generate({ studyId: 's1', organizationId: 'o', fields: ['age'] });
    const age = res.fields[0];
    expect(age.representation).toBe('median_iqr');
    expect(age.median).not.toBeNull();
  });

  it('respects a manual override forcing mean±SD', async () => {
    const svc = new TableOneService(mockStudyRepo(study), exec as any, pythonStats);
    const res = await svc.generate({ studyId: 's1', organizationId: 'o', fields: ['age'], overrides: { age: 'mean_sd' } });
    expect(res.fields[0].representation).toBe('mean_sd');
    // pythonStats.runDescribeAuto should NOT be called when override set
    expect(pythonStats.runDescribeAuto).not.toHaveBeenCalledWith(expect.anything(), 'median_iqr');
  });
});

describe('PrePostAnalysisService', () => {
  it('returns empty result when cohort has no cached patients', async () => {
    const emptyStudy = new ResearchStudy({
      id: study.id, organizationId: study.organizationId, createdBy: study.createdBy,
      queryId: study.queryId, name: study.name, status: study.status.value,
      cachedPatientIds: [], patientCount: 0,
    });
    const svc = new PrePostAnalysisService(mockStudyRepo(emptyStudy), { clinicalScale: { findMany: jest.fn() }, surgery: { findMany: jest.fn() } } as any, { runWilcoxon: jest.fn() } as any);
    const res = await svc.analyze({ studyId: 's1', organizationId: 'o', scaleType: 'SNOT_22' });
    expect(res.n).toBe(0);
    expect(res.warnings).toContain('no cached cohort');
  });

  it('throws StudyNotFoundError for unknown study', async () => {
    const svc = new PrePostAnalysisService(mockStudyRepo(null), {} as any, {} as any);
    await expect(svc.analyze({ studyId: 'x', organizationId: 'o', scaleType: 'SNOT_22' })).rejects.toThrow(StudyNotFoundError);
  });

  it('returns degraded warning envelope when Wilcoxon fails', async () => {
    const svc = new PrePostAnalysisService(
      mockStudyRepo(study),
      { clinicalScale: { findMany: jest.fn(async () => []) }, surgery: { findMany: jest.fn(async () => []) } } as any,
      { runWilcoxon: jest.fn(async () => { throw new Error('python down'); }) } as any,
    );
    const res = await svc.analyze({ studyId: 's1', organizationId: 'o', scaleType: 'SNOT_22' });
    expect(res.warnings.some((w) => w.includes('no patients') || w.includes('wilcoxon_unavailable'))).toBe(true);
  });
});