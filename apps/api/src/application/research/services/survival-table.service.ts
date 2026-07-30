// apps/api/src/application/research/services/survival-table.service.ts
// Survival probability table (M5). Samples a Kaplan-Meier SurvivalResult at
// the canonical follow-up time points (6, 12, 18, 24, 36 months) and renders a
// CSV string for download. Uses PythonStatsService.computeSurvival (KM) — same
// circuit-breaker + timeout + graceful-degradation pattern as the rest of the
// stats pipeline. The rendered table satisfies BR-RES-007 footer injection at
// the download edge (controller layer appends N/test/α).

import { Injectable, Inject } from '@nestjs/common';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import { ExecuteResearchQueryHandler, type ExecuteQueryResult } from '../queries/execute-research-query.handler';
import type { RawPatientRow } from './stats-calculator.service';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';
import type { SurvivalResult } from '@medicore/contracts';

export interface SurvivalTableCommand {
  studyId?: string;
  queryId?: string;
  organizationId: string;
  timeField: string;
  eventField: string;
  /** months at which to sample survival probability (defaults 6/12/18/24/36) */
  timePoints?: number[];
}

export interface SurvivalTableResult {
  queryId: string;
  timeField: string;
  eventField: string;
  n: number;
  rows: Array<{ months: number; survival: number | null; ciLower: number | null; ciUpper: number | null }>;
  medianSurvival: number | null;
  logRankP: number | null;
  warnings: string[];
  csv: string;
}

const DEFAULT_TIME_POINTS = [6, 12, 18, 24, 36];

@Injectable()
export class SurvivalTableService {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly executeQuery: ExecuteResearchQueryHandler,
    private readonly pythonStats: PythonStatsService,
  ) {}

  async generate(cmd: SurvivalTableCommand): Promise<SurvivalTableResult> {
    const { queryId, rows } = await this.resolveRows(cmd);
    const timeField = cmd.timeField;
    const eventField = cmd.eventField;
    const points = cmd.timePoints ?? DEFAULT_TIME_POINTS;

    // Build {times:number[], events:number[]} from rows. Time values are read
    // as numbers (months); non-numeric rows are skipped with a count.
    const times: number[] = [];
    const events: number[] = [];
    let skipped = 0;
    for (const row of rows) {
      const t = row[timeField];
      const e = row[eventField];
      const tn = Number(t);
      if (!Number.isFinite(tn) || t === null || t === undefined) { skipped++; continue; }
      const en = e === true || e === 'true' || e === 1 || e === '1' || e === 'yes' ? 1 : 0;
      times.push(tn);
      events.push(en);
    }

    const warnings: string[] = [];
    if (skipped > 0) warnings.push(`${skipped} rows skipped (non-numeric time)`);
    if (times.length === 0) {
      warnings.push('no valid time observations; survival table empty');
      return this.emptyResult(queryId, timeField, eventField, points, warnings);
    }

    let km: SurvivalResult;
    try {
      km = await this.pythonStats.computeSurvival(timeField, eventField, { times, events });
    } catch (err) {
      warnings.push(`survival_unavailable: ${(err as Error).message}`);
      const n = times.length;
      const rows = points.map((m) => ({ months: m, survival: null, ciLower: null, ciUpper: null }));
      return {
        queryId, timeField, eventField, n, rows,
        medianSurvival: null, logRankP: null, warnings,
        csv: this.toCsv(rows, n),
      };
    }

    const sampled = points.map((m) => {
      const idx = nearestIndex(km.timePoints, m);
      return {
        months: m,
        survival: idx >= 0 ? round(km.survival[idx]) : null,
        ciLower: idx >= 0 && km.ciLower ? round(km.ciLower[idx]) : null,
        ciUpper: idx >= 0 && km.ciUpper ? round(km.ciUpper[idx]) : null,
      };
    });

    const n = times.length;
    return {
      queryId,
      timeField,
      eventField,
      n,
      rows: sampled,
      medianSurvival: km.medianSurvival,
      logRankP: km.logRankP,
      warnings: [...warnings, ...km.warnings.map((w: unknown) => typeof w === 'string' ? w : (w as { message?: string }).message ?? 'warning')],
      csv: this.toCsv(sampled, n),
    };
  }

  private emptyResult(
    queryId: string,
    timeField: string,
    eventField: string,
    points: number[],
    warnings: string[],
  ): SurvivalTableResult {
    const rows = points.map((m) => ({ months: m, survival: null, ciLower: null, ciUpper: null }));
    return {
      queryId, timeField, eventField, n: 0, rows,
      medianSurvival: null, logRankP: null, warnings, csv: this.toCsv(rows, 0),
    };
  }

  private toCsv(rows: SurvivalTableResult['rows'], n: number): string {
    const header = 'months,survival,ci_lower,ci_upper';
    const body = rows.map((r) =>
      `${r.months},${r.survival ?? ''},${r.ciLower ?? ''},${r.ciUpper ?? ''}`,
    ).join('\n');
    return `${header}\n${body}\n# n=${n}`;
  }

  // ─────────────────────────────────────────────
  // Resolution — fetch rows from study or query
  // ─────────────────────────────────────────────
  private async resolveRows(cmd: SurvivalTableCommand): Promise<{ queryId: string; rows: RawPatientRow[] }> {
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
}

/** Index of the largest timePoint <= target (last survival ≤ target). */
function nearestIndex(timePoints: number[], target: number): number {
  let idx = -1;
  for (let i = 0; i < timePoints.length; i++) {
    if (timePoints[i] <= target) idx = i; else break;
  }
  return idx;
}

function round(v: number | null | undefined): number | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return Math.round(v * 1000) / 1000;
}