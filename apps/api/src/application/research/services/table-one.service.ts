// apps/api/src/application/research/services/table-one.service.ts
// Table 1 generation (M2). For each field, auto-select the statistic:
//   - continuous + normal  → mean ± SD
//   - continuous + non-normal → median (IQR)
//   - categorical          → n (%)
// p-values formatted with formatPValue (BR-RES-006). Optional two-group
// comparison adds a per-variable p-value column (t-test / Mann-Whitney / χ²).
//
// The service re-executes the study/query to fetch patient rows, then delegates
// normality to PythonStatsService (graceful degradation: on Python failure it
// falls back to median(IQR) for safety).

import { Injectable, Inject } from '@nestjs/common';
import type {
  IResearchStudyRepository,
} from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import { ExecuteResearchQueryHandler, type ExecuteQueryResult } from '../queries/execute-research-query.handler';
import type { RawPatientRow } from './stats-calculator.service';
import { PythonStatsService, type DescribeAutoResult } from '@/infrastructure/stats/python-stats.service';
import { formatPValue } from './p-value-format';

export interface TableOneFieldResult {
  field: string;
  n: number;
  representation: 'mean_sd' | 'median_iqr' | 'categorical';
  /** mean, sd */
  mean: number | null;
  sd: number | null;
  /** median, q1, q3 */
  median: number | null;
  q1: number | null;
  q3: number | null;
  categories: Array<{ label: string; count: number; percent: number }>;
  /** p-value vs second group, formatted string (BR-RES-006) — only for compare */
  pValue?: string;
}

export interface TableOneResult {
  queryId: string;
  totalN: number;
  groupBy?: string;
  fields: TableOneFieldResult[];
  warnings: string[];
}

export interface GenerateTableOneCommand {
  studyId?: string;
  queryId?: string;
  organizationId: string;
  fields: string[];
  groupBy?: string;
  /** Force a representation for a field (override auto-detection). */
  overrides?: Record<string, 'mean_sd' | 'median_iqr'>;
}

@Injectable()
export class TableOneService {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly executeQuery: ExecuteResearchQueryHandler,
    private readonly pythonStats: PythonStatsService,
  ) {}

  async generate(cmd: GenerateTableOneCommand): Promise<TableOneResult> {
    const { queryId, rows } = await this.resolveRows(cmd);
    const fields = cmd.fields;

    if (cmd.groupBy) {
      return this.compareGroups(queryId, rows, fields, cmd.groupBy, cmd.overrides);
    }
    const totalN = rows.length;
    const results: TableOneFieldResult[] = [];
    for (const field of fields) {
      results.push(await this.describeField(field, rows, cmd.overrides?.[field]));
    }
    return {
      queryId,
      totalN,
      groupBy: undefined,
      fields: results,
      warnings: this.collectWarnings(results),
    };
  }

  // ─────────────────────────────────────────────
  // Resolution — fetch rows from study or query
  // ─────────────────────────────────────────────
  private async resolveRows(cmd: GenerateTableOneCommand): Promise<{ queryId: string; rows: RawPatientRow[] }> {
    if (cmd.studyId) {
      const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
      if (!study) throw new StudyNotFoundError(cmd.studyId);
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
  // Single-group descriptive per field
  // ─────────────────────────────────────────────
  private async describeField(
    field: string,
    rows: RawPatientRow[],
    override?: 'mean_sd' | 'median_iqr',
  ): Promise<TableOneFieldResult> {
    const values = this.extractNumeric(rows, field);
    if (values.length === 0) {
      // categorical
      return this.describeCategorical(field, rows);
    }
    let representation = override;
    let describe: DescribeAutoResult | null = null;
    if (!representation) {
      try {
        describe = await this.pythonStats.runDescribeAuto(values);
        representation = describe.representation;
      } catch {
        // Python unavailable → safe fallback median(IQR)
        representation = 'median_iqr';
      }
    }
    if (representation === 'mean_sd') {
      const mean = describe?.mean ?? this.mean(values);
      const sd = describe?.sd ?? this.stddev(values);
      return { field, n: values.length, representation: 'mean_sd', mean, sd, median: null, q1: null, q3: null, categories: [] };
    }
    // median_iqr
    const sorted = [...values].sort((a, b) => a - b);
    const median = describe?.median ?? this.median(sorted);
    const q1 = describe?.q1 ?? this.percentile(sorted, 25);
    const q3 = describe?.q3 ?? this.percentile(sorted, 75);
    return { field, n: values.length, representation: 'median_iqr', mean: null, sd: null, median, q1, q3, categories: [] };
  }

  private describeCategorical(field: string, rows: RawPatientRow[]): TableOneFieldResult {
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
    return { field, n: total, representation: 'categorical', mean: null, sd: null, median: null, q1: null, q3: null, categories };
  }

  // ─────────────────────────────────────────────
  // Two-group comparison (TableOneCompareHandler)
  // ─────────────────────────────────────────────
  private async compareGroups(
    queryId: string,
    rows: RawPatientRow[],
    fields: string[],
    groupBy: string,
    overrides?: Record<string, 'mean_sd' | 'median_iqr'>,
  ): Promise<TableOneResult> {
    const groups = this.splitByGroup(rows, groupBy);
    const groupKeys = Array.from(groups.keys());
    const results: TableOneFieldResult[] = [];
    const warnings: string[] = [];

    for (const field of fields) {
      const fieldResults: TableOneFieldResult[] = [];
      for (const key of groupKeys) {
        fieldResults.push(await this.describeField(field, groups.get(key)!, overrides?.[field]));
      }
      // p-value across the two groups
      const pVal = await this.compareField(field, groups.get(groupKeys[0])!, groups.get(groupKeys[1]) ?? []);
      // Merge into one row with the first group's stats; pValue set
      const base = fieldResults[0];
      results.push({ ...base, pValue: pVal });
    }
    if (groupKeys.length !== 2) warnings.push('group comparison requires exactly 2 groups; got ' + groupKeys.length);
    return { queryId, totalN: rows.length, groupBy, fields: results, warnings };
  }

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

  private async compareField(field: string, g1: RawPatientRow[], g2: RawPatientRow[]): Promise<string> {
    const v1 = this.extractNumeric(g1, field);
    const v2 = this.extractNumeric(g2, field);
    // If both non-empty numeric → test; else categorical χ²
    if (v1.length >= 5 && v2.length >= 5) {
      try {
        // Decide normal vs non-normal via normality on combined sample
        let normal = true;
        try {
          const n = await this.pythonStats.runNormality([...v1, ...v2]);
          normal = n.isNormal;
        } catch {
          normal = false;
        }
        if (normal) {
          // Independent t-test via inferential
          const res = await this.pythonStats.runInferential('ttest_independent', {
            data: { group1: v1, group2: v2 },
          });
          return formatPValue(res.pValue);
        } else {
          const res = await this.pythonStats.runInferential('mannwhitney', {
            data: { group1: v1, group2: v2 },
          });
          return formatPValue(res.pValue);
        }
      } catch {
        return '—';
      }
    }
    // Categorical χ²
    try {
      const dist1 = this.categoricalCounts(g1, field);
      const dist2 = this.categoricalCounts(g2, field);
      const labels = new Set([...dist1.keys(), ...dist2.keys()]);
      const observed: number[][] = [
        Array.from(labels).map((l) => dist1.get(l) ?? 0),
        Array.from(labels).map((l) => dist2.get(l) ?? 0),
      ];
      const res = await this.pythonStats.runInferential('chi_square', { data: { observed } });
      return formatPValue(res.pValue);
    } catch {
      return '—';
    }
  }

  private categoricalCounts(rows: RawPatientRow[], field: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const v = row[field];
      if (v === null || v === undefined) continue;
      counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    }
    return counts;
  }

  // ─────────────────────────────────────────────
  // Stats helpers (used as fallback when Python down)
  // ─────────────────────────────────────────────
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

  private collectWarnings(results: TableOneFieldResult[]): string[] {
    const safe = results.filter((r) => r.n < 5);
    return safe.length ? [`some fields have n<5 (BR-RES-004): ${safe.map((r) => r.field).join(', ')}`] : [];
  }
}