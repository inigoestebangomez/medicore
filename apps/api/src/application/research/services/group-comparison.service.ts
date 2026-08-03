// apps/api/src/application/research/services/group-comparison.service.ts
// Multi-variable two-group comparison (M6). For each variable the service:
//   - splits rows by the groupBy field (exactly two groups required)
//   - decides categorical vs continuous (numeric-value presence)
//   - continuous + normal → Welch t-test (ttest_independent)
//     continuous + non-normal → Mann-Whitney (mannwhitney)
//     categorical → chi-square (chi_square), or Fisher on low expected counts
//   - formats p-values per BR-RES-006
// Uses Python for normality + the significance test; on Python failure it
// degrades gracefully with `pValue: '—'` and a warning (never 5xx).

import { Injectable, Inject } from '@nestjs/common';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import { ExecuteResearchQueryHandler, type ExecuteQueryResult } from '../queries/execute-research-query.handler';
import type { RawPatientRow } from './stats-calculator.service';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';
import { formatPValue } from './p-value-format';

export type ComparisonTest = 'ttest_independent' | 'mannwhitney' | 'chi_square' | 'fisher_exact';

export interface GroupVariableResult {
  field: string;
  /** auto-selected hypothesis test */
  test: ComparisonTest | null;
  /** formatted p-value (BR-RES-006) — '—' when unavailable */
  pValue: string;
  statistic: number | null;
  /** descriptive per group */
  groups: Array<{
    key: string;
    n: number;
    representation: 'mean_sd' | 'median_iqr' | 'categorical';
    mean: number | null;
    sd: number | null;
    median: number | null;
    q1: number | null;
    q3: number | null;
    categories: Array<{ label: string; count: number; percent: number }>;
  }>;
  warnings: string[];
}

export interface GroupComparisonResult {
  queryId: string;
  groupBy: string;
  groups: string[];
  variables: GroupVariableResult[];
  warnings: string[];
}

export interface GroupComparisonCommand {
  studyId?: string;
  queryId?: string;
  organizationId: string;
  groupBy: string;
  variableFields: string[];
  overrides?: Record<string, 'mean_sd' | 'median_iqr'>;
}

const MIN_PER_GROUP_FOR_TEST = 5;

@Injectable()
export class GroupComparisonService {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly executeQuery: ExecuteResearchQueryHandler,
    private readonly pythonStats: PythonStatsService,
  ) {}

  async compare(cmd: GroupComparisonCommand): Promise<GroupComparisonResult> {
    const { queryId, rows } = await this.resolveRows(cmd);
    const groups = this.splitByGroup(rows, cmd.groupBy);
    const groupKeys = Array.from(groups.keys());

    const warnings: string[] = [];
    if (groupKeys.length !== 2) {
      warnings.push(`group comparison requires exactly 2 groups; got ${groupKeys.length}`);
    }
    const [g1, g2] = [groups.get(groupKeys[0]) ?? [], groups.get(groupKeys[1]) ?? []];

    const variables: GroupVariableResult[] = [];
    for (const field of cmd.variableFields) {
      variables.push(await this.compareVariable(field, g1, g2, groupKeys, cmd.overrides?.[field]));
    }

    return { queryId, groupBy: cmd.groupBy, groups: groupKeys, variables, warnings };
  }

  // ─────────────────────────────────────────────
  // Resolution — fetch rows from study or query
  // ─────────────────────────────────────────────
  private async resolveRows(cmd: GroupComparisonCommand): Promise<{ queryId: string; rows: RawPatientRow[] }> {
    if (cmd.studyId) {
      const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
      if (!study) throw new StudyNotFoundError(cmd.studyId);
      if (!study.queryId) throw new Error('studyId or queryId is required');
      const executed = await this.executeQuery.execute({ queryId: study.queryId, organizationId: cmd.organizationId });
      return { queryId: study.queryId, rows: this.toRawRows(executed) };
    }
    if (!cmd.queryId) throw new Error('studyId or queryId is required');
    const executed = await this.executeQuery.execute({ queryId: cmd.queryId, organizationId: cmd.organizationId });
    return { queryId: cmd.queryId, rows: this.toRawRows(executed) };
  }

  private toRawRows(executed: ExecuteQueryResult): RawPatientRow[] {
    return executed.rows.map((r) => ({ patientId: r.patientId, nhc: r.nhc, ...r.fields })) as RawPatientRow[];
  }

  // ─────────────────────────────────────────────
  // Per-variable comparison
  // ─────────────────────────────────────────────
  private async compareVariable(
    field: string,
    g1: RawPatientRow[],
    g2: RawPatientRow[],
    groupKeys: string[],
    override?: 'mean_sd' | 'median_iqr',
  ): Promise<GroupVariableResult> {
    const v1 = this.extractNumeric(g1, field);
    const v2 = this.extractNumeric(g2, field);
    const warnings: string[] = [];
    const isContinuous = v1.length > 0 && v2.length > 0;

    const desc1 = this.describeGroup(field, g1, v1, override);
    const desc2 = this.describeGroup(field, g2, v2, override);
    const groups = [
      { key: groupKeys[0] ?? 'Group A', ...desc1 },
      { key: groupKeys[1] ?? 'Group B', ...desc2 },
    ];

    if (!isContinuous) {
      // categorical compare via χ² (we still return per-group categoricals)
      const { test, pValue, statistic } = await this.categoricalTest(g1, g2, field, warnings);
      return { field, test, pValue, statistic, groups, warnings };
    }

    if (v1.length < MIN_PER_GROUP_FOR_TEST || v2.length < MIN_PER_GROUP_FOR_TEST) {
      warnings.push(`n<${MIN_PER_GROUP_FOR_TEST} in one group; test not performed`);
      return { field, test: null, pValue: '—', statistic: null, groups, warnings };
    }
    return this.continuousTest(field, v1, v2, groups, warnings);
  }

  private describeGroup(
    field: string,
    rows: RawPatientRow[],
    values: number[],
    override?: 'mean_sd' | 'median_iqr',
  ): Omit<GroupVariableResult['groups'][number], 'key'> {
    if (values.length === 0) {
      return this.describeCategorical(rows, field);
    }
    let representation = override;
    let mean: number | null = null;
    let sd: number | null = null;
    let median: number | null = null;
    let q1: number | null = null;
    let q3: number | null = null;
    if (!representation) {
      // safe default: median(iqr). Normality-driven choice happens at the
      // test step; descriptive representation follows the test decision.
      representation = 'median_iqr';
    }
    if (representation === 'mean_sd') {
      mean = this.mean(values);
      sd = this.stddev(values);
    } else {
      const sorted = [...values].sort((a, b) => a - b);
      median = this.median(sorted);
      q1 = this.percentile(sorted, 25);
      q3 = this.percentile(sorted, 75);
    }
    return {
      n: values.length, representation,
      mean, sd, median, q1, q3,
      categories: [],
    };
  }

  private describeCategorical(rows: RawPatientRow[], field: string): Omit<GroupVariableResult['groups'][number], 'key'> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const v = row[field];
      if (v === null || v === undefined || v === '') continue;
      counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const categories = Array.from(counts.entries())
      .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.count - a.count);
    return { n: total, representation: 'categorical', mean: null, sd: null, median: null, q1: null, q3: null, categories };
  }

  private async continuousTest(
    field: string,
    v1: number[],
    v2: number[],
    groups: GroupVariableResult['groups'],
    warnings: string[],
  ): Promise<GroupVariableResult> {
    let normal = true;
    try {
      const n = await this.pythonStats.runNormality([...v1, ...v2]);
      normal = n.isNormal;
    } catch {
      normal = false;
      warnings.push('normality_unavailable_assumed_non_normal');
    }
    const representation = normal ? 'mean_sd' : 'median_iqr';
    // recompute per-group representation consistent with test
    const enriched = groups.map((g) => {
      if (g.representation === 'mean_sd' || g.representation === 'median_iqr') {
        return { ...g, representation: representation as any };
      }
      return g;
    });
    const test: ComparisonTest = normal ? 'ttest_independent' : 'mannwhitney';
    try {
      const res = await this.pythonStats.runInferential(test, {
        data: { group1: v1, group2: v2 },
      });
      return { field, test, pValue: formatPValue(res.pValue), statistic: res.statistic, groups: enriched, warnings };
    } catch (err) {
      warnings.push(`test_unavailable: ${(err as Error).message}`);
      return { field, test, pValue: '—', statistic: null, groups: enriched, warnings };
    }
  }

  private async categoricalTest(
    g1: RawPatientRow[],
    g2: RawPatientRow[],
    field: string,
    warnings: string[],
  ): Promise<Pick<GroupVariableResult, 'test' | 'pValue' | 'statistic'>> {
    const dist1 = this.categoricalCounts(g1, field);
    const dist2 = this.categoricalCounts(g2, field);
    const labels = new Set([...dist1.keys(), ...dist2.keys()]);
    if (labels.size === 0) {
      return { test: null, pValue: '—', statistic: null };
    }
    const observed: number[][] = [
      Array.from(labels).map((l) => dist1.get(l) ?? 0),
      Array.from(labels).map((l) => dist2.get(l) ?? 0),
    ];
    const fisherWarranted = observed.some((row) => row.some((c) => c < 5));
    const test: ComparisonTest = fisherWarranted ? 'fisher_exact' : 'chi_square';
    try {
      const res = await this.pythonStats.runInferential(test, { data: { observed } });
      return { test, pValue: formatPValue(res.pValue), statistic: res.statistic };
    } catch (err) {
      warnings.push(`categorical_test_unavailable: ${(err as Error).message}`);
      return { test, pValue: '—', statistic: null };
    }
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  private splitByGroup(rows: RawPatientRow[], groupBy: string): Map<string, RawPatientRow[]> {
    const groups = new Map<string, RawPatientRow[]>();
    for (const row of rows) {
      const key = String(row[groupBy] ?? 'Unknown');
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }
    return groups;
  }

  private extractNumeric(rows: RawPatientRow[], field: string): number[] {
    const out: number[] = [];
    for (const row of rows) {
      const v = row[field];
      if (v === null || v === undefined) continue;
      const n = Number(v);
      if (!Number.isNaN(n) && Number.isFinite(n)) out.push(n);
    }
    return out;
  }

  private categoricalCounts(rows: RawPatientRow[], field: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const v = row[field];
      if (v === null || v === undefined || v === '') continue;
      counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    }
    return counts;
  }

  private mean(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = this.mean(values);
    return Math.sqrt(values.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (values.length - 1));
  }

  private median(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }
}