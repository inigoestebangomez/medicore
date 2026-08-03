// apps/api/src/application/research/commands/analysis.handler.ts
// RunAnalysisHandler (REQ-FB-010, REQ-FB-011, REQ-FB-012): dispatches a
// statistical analysis to the Python stats service, persists the traceability
// record in StatisticalAnalysis, and labels risk/protective factor from the
// OR/HR effect estimate. ListAnalysesHandler returns the run history.

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StatisticalAnalysis } from '@/domain/research/statistical-analysis.entity';
import { StudyVariable } from '@/domain/research/study-variable.entity';
import { StudySubject } from '@/domain/research/study-subject.entity';
import type { IStatisticalAnalysisRepository } from '@/domain/research/ports/statistical-analysis.repository.interface';
import type { IStudySubjectRepository } from '@/domain/research/ports/study-subject.repository.interface';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';
import type { AnalysisTest, RunAnalysisInput } from '@medicore/contracts';

const AGREEMENT_TESTS = new Set<AnalysisTest>(['KAPPA', 'ICC', 'CRONBACH']);

export interface RunAnalysisCommand {
  organizationId: string;
  studyId: string;
  input: RunAnalysisInput;
}

@Injectable()
export class RunAnalysisHandler {
  constructor(
    @Inject('IStatisticalAnalysisRepository') private readonly analysisRepo: IStatisticalAnalysisRepository,
    @Inject('IStudySubjectRepository') private readonly subjectRepo: IStudySubjectRepository,
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly stats: PythonStatsService,
  ) {}

  async execute(cmd: RunAnalysisCommand): Promise<StatisticalAnalysis> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);

    const variables = await this.varRepo.findByStudy(cmd.studyId, cmd.organizationId);
    const byId = new Map(variables.map((v) => [v.id, v]));
    // Verify all requested variables exist and the test is compatible.
    for (const id of cmd.input.variableIds) {
      const v = byId.get(id);
      if (!v) throw new Error(`variable_not_found: ${id}`);
      if (!v.type.supports(cmd.input.test)) {
        throw new Error(`test_not_compatible: ${cmd.input.test} for ${v.type.value} (${v.name})`);
      }
    }

    // Gather per-subject values for the requested variables.
    const subjects = await this.subjectRepo.findByStudy(cmd.studyId, cmd.organizationId, { page: 1, pageSize: 10000 });
    const scoped = cmd.input.subjectIds
      ? subjects.items.filter((s) => cmd.input.subjectIds!.includes(s.id))
      : subjects.items;
    const data = this.buildDataPayload(scoped, cmd.input.variableIds, byId);

    // Dispatch by test family.
    let statistic: number | null = null;
    let pValue: number | null = null;
    let ci95: { lower: number; upper: number } | null = null;
    let effectSize: Record<string, unknown> | null = null;
    const n = scoped.length;
    // params is a Zod record of unknown values; coerce alpha to a number safely.
    const params = (cmd.input.params ?? {}) as Record<string, unknown>;
    const alpha = Number(params.alpha ?? 0.05);

    if (AGREEMENT_TESTS.has(cmd.input.test)) {
      const res = await this.runAgreement(cmd.input.test, data, alpha);
      statistic = res.statistic ?? null;
      pValue = res.pValue ?? null;
      ci95 = res.ci95 ?? null;
      // Agreement tests (Kappa/ICC/Cronbach) produce no OR/HR effect
      // estimate, so risk-factor labeling (REQ-FB-011) does not apply.
      effectSize = null;
    } else {
      // Inferential / regression tests -> Python inferential endpoint.
      const inferential = mapToInferentialTest(cmd.input.test);
      const res = await this.stats.runInferential(inferential, {
        data,
        alpha,
      });
      statistic = res.statistic ?? null;
      pValue = res.pValue ?? null;
      if (res.ci95Lower != null && res.ci95Upper != null) {
        ci95 = { lower: res.ci95Lower, upper: res.ci95Upper };
      }
      if (res.effectSize) {
        effectSize = {
          name: res.effectSize.name,
          value: res.effectSize.value,
          or: res.effectSize.name === 'odds_ratio' ? res.effectSize.value : null,
          hr: res.effectSize.name === 'hazard_ratio' ? res.effectSize.value : null,
        };
      }
    }

    let analysis = StatisticalAnalysis.create({
      id: randomUUID(),
      organizationId: cmd.organizationId,
      studyId: cmd.studyId,
      test: cmd.input.test,
      variableIds: cmd.input.variableIds,
      params: cmd.input.params ?? {},
      n,
      statistic,
      pValue,
      ci95,
      effectSize,
    });

    // REQ-FB-011: label risk/protective factor from OR/HR when applicable.
    if (effectSize) {
      const effect = (effectSize.or as number | null) ?? (effectSize.hr as number | null) ?? null;
      if (effect !== null) analysis = analysis.labelRiskFactor(effect, pValue);
    }

    return this.analysisRepo.create(analysis);
  }

  private buildDataPayload(
    subjects: StudySubject[],
    variableIds: string[],
    byId: Map<string, StudyVariable>,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const id of variableIds) {
      const v = byId.get(id)!;
      data[v.name] = subjects
        .map((s) => s.getValue(id))
        .filter((x) => x !== undefined && x !== null && x !== '');
    }
    return data;
  }

  private async runAgreement(
    test: AnalysisTest,
    data: Record<string, unknown>,
    alpha: number,
  ): Promise<{
    statistic: number | null;
    pValue: number | null;
    ci95?: { lower: number; upper: number } | null;
  }> {
    if (test === 'KAPPA') {
      const r = await this.stats.runKappa(data.raterA as any[], data.raterB as any[], alpha);
      return { statistic: r.statistic, pValue: r.pValue, ci95: null };
    }
    if (test === 'ICC') {
      const r = await this.stats.runIcc(data.valuesByRater as number[][], alpha);
      return { statistic: r.statistic, pValue: r.pValue, ci95: null };
    }
    if (test === 'CRONBACH') {
      const r = await this.stats.runCronbach(data.itemsBySubject as number[][], alpha);
      return { statistic: r.statistic, pValue: r.pValue, ci95: null };
    }
    throw new Error(`unsupported_agreement_test: ${test}`);
  }
}

@Injectable()
export class ListAnalysesHandler {
  constructor(
    @Inject('IStatisticalAnalysisRepository') private readonly analysisRepo: IStatisticalAnalysisRepository,
  ) {}

  async execute(cmd: { organizationId: string; studyId: string }): Promise<StatisticalAnalysis[]> {
    return this.analysisRepo.findByStudy(cmd.studyId, cmd.organizationId);
  }
}

/** Map V4 AnalysisTest to the V3 InferentialTestType for the Python inferential endpoint. */
function mapToInferentialTest(t: AnalysisTest): import('@medicore/contracts').InferentialTestType {
  const map: Partial<Record<AnalysisTest, import('@medicore/contracts').InferentialTestType>> = {
    T_TEST: 'ttest_independent',
    MANN_WHITNEY: 'mannwhitney',
    ANOVA: 'anova_oneway',
    CHI_SQUARE: 'chi_square',
    FISHER: 'fisher_exact',
    PEARSON: 'pearson',
    SPEARMAN: 'spearman',
    LOGISTIC: 'logistic_regression',
    KAPLAN_MEIER: 'kaplan_meier',
  };
  const mapped = map[t];
  if (!mapped) throw new Error(`test_not_supported_by_inferential: ${t}`);
  return mapped;
}