// apps/api/src/application/research/services/guided-analysis.service.ts
// Orchestrates the guided statistical analysis workflow (V5).
// Coordinates: ExecuteResearchQueryHandler → ExposureDomainResolver →
// TestSelectionPolicy → PythonStatsService → safety/rationale envelope.
// Creates a GuidedAnalysisRun snapshot for reproducibility.

import { Injectable, Inject, Logger } from '@nestjs/common';
import type {
  GuidedAnalysisRequest,
  GuidedAnalysisResult,
  GuidedDescriptiveSummary,
  GuidedInferentialResult,
  GuidedCorrection,
  AssumptionWarning,
  EffectMeasure,
} from '@medicore/contracts';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ExecuteResearchQueryHandler } from '../queries/execute-research-query.handler';
import { TestSelectionPolicy } from './test-selection.policy';
import { ExposureDomainResolver } from './exposure-domain.resolver';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';
import { formatPValue } from './p-value-format';

export class InvalidCohortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCohortError';
  }
}

@Injectable()
export class GuidedAnalysisService {
  private readonly logger = new Logger(GuidedAnalysisService.name);

  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly executeQuery: ExecuteResearchQueryHandler,
    private readonly testPolicy: TestSelectionPolicy,
    private readonly exposureResolver: ExposureDomainResolver,
    private readonly pythonStats: PythonStatsService,
  ) {}

  async execute(
    request: GuidedAnalysisRequest,
    organizationId: string,
  ): Promise<GuidedAnalysisResult> {
    // 1. Validate cohort exists
    const query = await this.queryRepo.findById(request.queryId, organizationId);
    if (!query) {
      throw new InvalidCohortError(`Research query not found: ${request.queryId}`);
    }

    // 2. Execute query to get cohort rows
    const executed = await this.executeQuery.execute({
      queryId: request.queryId,
      organizationId,
    });

    if (executed.totalRows === 0) {
      throw new InvalidCohortError('Cohort is empty. Cannot perform analysis on zero patients.');
    }

    // 3. Build cohort context
    const cohort = {
      queryId: request.queryId,
      n: executed.totalRows,
      filters: executed.appliedFilters,
    };

    // 4. Dispatch by path
    if (request.path === 'descriptive') {
      return this.runDescriptive(request, executed, cohort);
    }
    return this.runInferential(request, executed, cohort, organizationId);
  }

  // ─────────────────────────────────────────────
  // Path 1: Descriptive analysis
  // ─────────────────────────────────────────────

  private async runDescriptive(
    request: GuidedAnalysisRequest,
    executed: Awaited<ReturnType<ExecuteResearchQueryHandler['execute']>>,
    cohort: GuidedAnalysisResult['cohort'],
  ): Promise<GuidedAnalysisResult> {
    const rows = executed.rows.map((r) => ({ ...r.fields })) as Array<Record<string, unknown>>;
    const summaries: GuidedDescriptiveSummary[] = [];
    const warnings: AssumptionWarning[] = [];

    for (const variable of request.variables) {
      const summary = this.describeVariable(variable, rows);
      summaries.push(summary);
      if (summary.suppressed) {
        warnings.push({
          code: 'insufficient_data',
          message: `Variable '${variable}' has insufficient observations for reliable summary.`,
          suggestion: 'Consider selecting a variable with more data.',
        });
      }
    }

    return {
      runId: this.generateRunId(),
      cohort,
      path: 'descriptive',
      summaries,
      results: [],
      rationale: ['Descriptive analysis: summarizes cohort characteristics without hypothesis testing.'],
      corrections: [],
      warnings,
    };
  }

  private describeVariable(
    variable: string,
    rows: Array<Record<string, unknown>>,
  ): GuidedDescriptiveSummary {
    const values: number[] = [];
    const categories = new Map<string, number>();
    let missing = 0;
    let isQuantitative = true;

    for (const row of rows) {
      const raw = row[variable];
      if (raw === null || raw === undefined || raw === '') {
        missing++;
        continue;
      }
      const num = Number(raw);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        values.push(num);
      } else {
        isQuantitative = false;
        const label = String(raw);
        categories.set(label, (categories.get(label) ?? 0) + 1);
      }
    }

    const n = isQuantitative ? values.length : Array.from(categories.values()).reduce((a, b) => a + b, 0);

    // Suppress if insufficient data
    if (n < 5) {
      return {
        variable,
        kind: isQuantitative ? 'quantitative' : 'qualitative',
        n,
        missing,
        mean: null, sd: null, median: null, q1: null, q3: null, min: null, max: null,
        categories: [],
        suppressed: true,
        suppressReason: `insufficient_observations: n=${n} < 5`,
      };
    }

    if (isQuantitative) {
      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1));
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      const q1 = this.percentile(sorted, 25);
      const q3 = this.percentile(sorted, 75);

      return {
        variable,
        kind: 'quantitative',
        n: values.length,
        missing,
        mean: this.round(mean),
        sd: this.round(sd),
        median: this.round(median),
        q1: this.round(q1),
        q3: this.round(q3),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        categories: [],
        suppressed: false,
      };
    }

    // Qualitative
    const total = Array.from(categories.values()).reduce((a, b) => a + b, 0);
    const catArray = Array.from(categories.entries())
      .map(([label, count]) => ({
        label,
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      variable,
      kind: 'qualitative',
      n: total,
      missing,
      mean: null, sd: null, median: null, q1: null, q3: null, min: null, max: null,
      categories: catArray,
      suppressed: false,
    };
  }

  // ─────────────────────────────────────────────
  // Path 2: Inferential analysis
  // ─────────────────────────────────────────────

  private async runInferential(
    request: GuidedAnalysisRequest,
    executed: Awaited<ReturnType<ExecuteResearchQueryHandler['execute']>>,
    cohort: GuidedAnalysisResult['cohort'],
    organizationId: string,
  ): Promise<GuidedAnalysisResult> {
    if (!request.exposure) {
      throw new InvalidCohortError('Inferential analysis requires an exposure domain and elements.');
    }
    if (!request.outcome) {
      throw new InvalidCohortError('Inferential analysis requires an outcome variable.');
    }

    const rows = executed.rows.map((r) => ({ ...r.fields })) as Array<Record<string, unknown>>;

    // Resolve exposure elements
    const exposure = this.exposureResolver.resolve(
      request.exposure.domain,
      rows,
      request.exposure.elementIds,
    );

    const isPaired = !!request.paired;
    const groupCount = isPaired ? 2 : Math.min(exposure.elements.length, 2);

    // Check normality of outcome
    const outcomeValues = this.extractNumeric(rows, request.outcome);
    let isNormal = true;
    try {
      const normalityResult = await this.pythonStats.runNormality(outcomeValues);
      isNormal = normalityResult.isNormal;
    } catch {
      isNormal = false;
    }

    // Check if outcome is binary
    const uniqueOutcomeValues = new Set(outcomeValues.map(String));
    const isBinary = uniqueOutcomeValues.size <= 2;

    // Select test
    const selection = this.testPolicy.select({
      groupCount,
      paired: isPaired,
      isNormal,
      isBinary,
    });

    const results: GuidedInferentialResult[] = [];
    const warnings: AssumptionWarning[] = [];
    const rationale: string[] = [selection.rationale];

    if (selection.test) {
      // Execute the selected test
      const result = await this.executeTest(
        selection.test,
        request,
        rows,
        exposure,
        isPaired,
      );
      results.push(result);
      warnings.push(...result.warnings);

      // If binary 2x2 → compute RR/OR
      if (isBinary && groupCount === 2 && !isPaired) {
        const rrResult = await this.computeEffectMeasures(rows, request, exposure);
        if (rrResult) {
          results[0].effectMeasures = rrResult;
        }
      }
    } else {
      warnings.push({
        code: 'test_not_selected',
        message: 'No appropriate test could be selected for this comparison.',
        suggestion: 'Check that you have ≥2 exposure elements and a valid outcome.',
      });
    }

    // Apply multiple comparison correction if requested
    const corrections: GuidedCorrection[] = [];
    if (request.correction && results.length > 0) {
      const pValues = results.map((r) => r.pValue).filter((p): p is number => p !== null);
      if (pValues.length > 1) {
        try {
          const adj = await this.pythonStats.adjustPValues({
            method: request.correction,
            pValues,
          });
          for (let i = 0; i < results.length; i++) {
            if (results[i].pValue !== null && adj.adjustedP[i] !== undefined) {
              corrections.push({
                method: request.correction,
                adjustedP: adj.adjustedP[i],
                originalP: results[i].pValue,
                label: `${results[i].variable ?? 'comparison'}: p adjusted via ${request.correction.toUpperCase()}`,
              });
            }
          }
        } catch (err) {
          this.logger.warn(`P-value adjustment failed: ${(err as Error).message}`);
          warnings.push({
            code: 'adjustment_failed',
            message: `P-value adjustment (${request.correction}) failed. Raw p-values are reported.`,
          });
        }
      }
    }

    // Add selection warnings
    for (const w of selection.warnings) {
      warnings.push({
        code: 'selection_warning',
        message: w,
      });
    }

    return {
      runId: this.generateRunId(),
      cohort,
      path: 'inferential',
      summaries: [],
      results,
      rationale,
      corrections,
      warnings,
    };
  }

  private async executeTest(
    test: string,
    request: GuidedAnalysisRequest,
    rows: Array<Record<string, unknown>>,
    exposure: ReturnType<ExposureDomainResolver['resolve']>,
    isPaired: boolean,
  ): Promise<GuidedInferentialResult> {
    const warnings: AssumptionWarning[] = [];

    try {
      // Build data payload based on test type
      const data = this.buildTestData(test, request, rows, exposure, isPaired);
      const result = await this.pythonStats.runInferential(test as any, { data });

      return {
        variable: request.outcome,
        test,
        statistic: result.statistic,
        pValue: result.pValue,
        effectMeasures: [],
        groups: exposure.elements.slice(0, 2).map((e) => ({ key: e.label, n: e.count })),
        rationale: undefined,
        warnings: result.warnings ?? [],
      };
    } catch (err) {
      warnings.push({
        code: 'test_execution_failed',
        message: `Test '${test}' failed: ${(err as Error).message}`,
        suggestion: 'The statistical service may be temporarily unavailable.',
      });
      return {
        variable: request.outcome,
        test,
        statistic: null,
        pValue: null,
        effectMeasures: [],
        groups: [],
        warnings,
      };
    }
  }

  private buildTestData(
    test: string,
    request: GuidedAnalysisRequest,
    rows: Array<Record<string, unknown>>,
    exposure: ReturnType<ExposureDomainResolver['resolve']>,
    isPaired: boolean,
  ): Record<string, unknown> {
    const outcomeField = request.outcome!;
    const sourceField = exposure.sourceField;

    if (isPaired && request.paired) {
      // Paired: extract pre/post values
      const pre: number[] = [];
      const post: number[] = [];
      for (const row of rows) {
        const preVal = Number(row[request.paired.pre]);
        const postVal = Number(row[request.paired.post]);
        if (!Number.isNaN(preVal) && !Number.isNaN(postVal)) {
          pre.push(preVal);
          post.push(postVal);
        }
      }
      return { group1: pre, group2: post };
    }

    // Group-based tests
    const elements = exposure.elements.slice(0, 2); // Take first 2 for comparison
    const groups: number[][] = elements.map(() => []);

    for (const row of rows) {
      const fieldValue = row[sourceField];
      const elementId = this.extractElementIdFromField(fieldValue, elements.map((e) => e.elementId));
      if (!elementId) continue;

      const groupIdx = elements.findIndex((e) => e.elementId === elementId);
      if (groupIdx < 0) continue;

      const val = Number(row[outcomeField]);
      if (!Number.isNaN(val) && Number.isFinite(val)) {
        groups[groupIdx].push(val);
      }
    }

    if (test === 'chi_square' || test === 'fisher_exact') {
      // Build observed table
      const observed = this.buildObservedTable(rows, sourceField, outcomeField, elements);
      return { observed };
    }

    if (test === 'anova_oneway' || test === 'kruskalwallis') {
      return { groups };
    }

    return { group1: groups[0] ?? [], group2: groups[1] ?? [] };
  }

  private buildObservedTable(
    rows: Array<Record<string, unknown>>,
    sourceField: string,
    outcomeField: string,
    elements: Array<{ elementId: string }>,
  ): number[][] {
    const outcomeValues = new Set<string>();
    for (const row of rows) {
      const v = row[outcomeField];
      if (v !== null && v !== undefined) outcomeValues.add(String(v));
    }
    const outcomeLabels = Array.from(outcomeValues).sort();

    const table: number[][] = elements.map(() => outcomeLabels.map(() => 0));

    for (const row of rows) {
      const fieldValue = row[sourceField];
      const elementId = this.extractElementIdFromField(fieldValue, elements.map((e) => e.elementId));
      if (!elementId) continue;

      const groupIdx = elements.findIndex((e) => e.elementId === elementId);
      if (groupIdx < 0) continue;

      const outcomeLabel = String(row[outcomeField]);
      const outcomeIdx = outcomeLabels.indexOf(outcomeLabel);
      if (outcomeIdx >= 0) {
        table[groupIdx][outcomeIdx]++;
      }
    }

    return table;
  }

  private async computeEffectMeasures(
    rows: Array<Record<string, unknown>>,
    request: GuidedAnalysisRequest,
    exposure: ReturnType<ExposureDomainResolver['resolve']>,
  ): Promise<EffectMeasure[] | null> {
    if (!request.exposure || !request.outcome) return null;

    const elements = exposure.elements.slice(0, 2);
    const sourceField = exposure.sourceField;
    const outcomeField = request.outcome;

    // Build 2x2 table: exposed vs unexposed, outcome present vs absent
    const outcomeValues = new Set<string>();
    for (const row of rows) {
      const v = row[outcomeField];
      if (v !== null && v !== undefined) outcomeValues.add(String(v));
    }
    const outcomeLabels = Array.from(outcomeValues).sort();
    if (outcomeLabels.length !== 2) return null; // Need exactly binary outcome

    // exposed = first element, unexposed = second element
    let exposedCases = 0, exposedNonCases = 0;
    let unexposedCases = 0, unexposedNonCases = 0;
    const positiveOutcome = outcomeLabels[1]; // Second label = "case"

    for (const row of rows) {
      const fieldValue = row[sourceField];
      const elementId = this.extractElementIdFromField(fieldValue, elements.map((e) => e.elementId));
      if (!elementId) continue;

      const outcome = String(row[outcomeField]);
      const isCase = outcome === positiveOutcome;
      const isExposed = elementId === elements[0].elementId;

      if (isExposed && isCase) exposedCases++;
      else if (isExposed && !isCase) exposedNonCases++;
      else if (!isExposed && isCase) unexposedCases++;
      else if (!isExposed && !isCase) unexposedNonCases++;
    }

    try {
      const rr = await this.pythonStats.computeRelativeRisk({
        exposedCases,
        exposedNonCases,
        unexposedCases,
        unexposedNonCases,
      });

      const measures: EffectMeasure[] = [];

      if (!rr.suppressed) {
        measures.push({
          name: 'relative_risk',
          value: rr.relativeRisk,
          ci95Lower: rr.ci95Lower,
          ci95Upper: rr.ci95Upper,
          suppressed: false,
        });
        measures.push({
          name: 'odds_ratio',
          value: rr.oddsRatio,
          ci95Lower: rr.orCi95Lower,
          ci95Upper: rr.orCi95Upper,
          suppressed: false,
        });
      } else {
        measures.push({
          name: 'relative_risk',
          value: null,
          ci95Lower: null,
          ci95Upper: null,
          suppressed: true,
          suppressReason: rr.suppressReason ?? 'zero_cell',
        });
        measures.push({
          name: 'odds_ratio',
          value: null,
          ci95Lower: null,
          ci95Upper: null,
          suppressed: true,
          suppressReason: rr.suppressReason ?? 'zero_cell',
        });
      }

      return measures;
    } catch (err) {
      this.logger.warn(`Effect measures computation failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private extractNumeric(rows: Array<Record<string, unknown>>, field: string): number[] {
    const values: number[] = [];
    for (const row of rows) {
      const v = Number(row[field]);
      if (!Number.isNaN(v) && Number.isFinite(v)) values.push(v);
    }
    return values;
  }

  private extractElementIdFromField(fieldValue: unknown, validIds: string[]): string | null {
    if (!fieldValue) return null;
    const elements = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
    for (const el of elements) {
      let id: string | null = null;
      if (typeof el === 'string') id = el;
      else if (typeof el === 'object' && el !== null) {
        const obj = el as Record<string, unknown>;
        id = (obj.code ?? obj.id ?? obj.elementId ?? obj.name) as string | null;
      }
      if (id && validIds.includes(id)) return id;
    }
    return null;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private generateRunId(): string {
    return crypto.randomUUID();
  }
}
