// apps/api/src/application/research/services/pre-post-analysis.service.ts
// Pre/Post paired analysis (M3). Temporal matching:
//   pre  = closest measurement ≤ preWindowDays (30) before surgeryDate
//   post = measurement within ±postWindowDays (15) of a target = surgeryDate
//         (or the closest post-surgery measurement within the window)
// Then runs Wilcoxon signed-rank via PythonStatsService (graceful degradation:
// returns a warning envelope when Python is unavailable; never 5xx).
//
// Reads ClinicalScale rows for the study's cached cohort filtered by scaleType.

import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import { PythonStatsService, type WilcoxonResult } from '@/infrastructure/stats/python-stats.service';
import { formatPValue } from './p-value-format';

export interface PrePostCommand {
  studyId: string;
  organizationId: string;
  scaleType: string;
  /** ISO date string or Date — anchor (usually surgery date). */
  surgeryDate?: string | Date;
  preWindowDays?: number;
  postWindowDays?: number;
}

export interface PrePostResult {
  studyId: string;
  scaleType: string;
  n: number;
  wilcoxon: WilcoxonResult | null;
  pValue: string;
  meanPre: number | null;
  meanPost: number | null;
  meanDifference: number | null;
  percentImprovement: number | null;
  warnings: string[];
}

const DEFAULT_PRE_DAYS = 30;
const DEFAULT_POST_DAYS = 15;
const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class PrePostAnalysisService {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly prisma: PrismaService,
    private readonly pythonStats: PythonStatsService,
  ) {}

  async analyze(cmd: PrePostCommand): Promise<PrePostResult> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    const patientIds = study.cachedPatientIds;
    if (patientIds.length === 0) {
      return this.empty(cmd.studyId, cmd.scaleType, ['no cached cohort']);
    }

    const preDays = cmd.preWindowDays ?? DEFAULT_PRE_DAYS;
    const postDays = cmd.postWindowDays ?? DEFAULT_POST_DAYS;

    // Fetch all surgeries (anchor) + scales of the requested type for the cohort
    const [surgeries, scales] = await Promise.all([
      this.prisma.surgery.findMany({
        where: { organizationId: cmd.organizationId, patientId: { in: patientIds }, deletedAt: null },
        select: { patientId: true, date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.clinicalScale.findMany({
        where: {
          organizationId: cmd.organizationId,
          patientId: { in: patientIds },
          scaleType: cmd.scaleType as any,
          deletedAt: null,
        },
        select: { patientId: true, date: true, total: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const firstSurgeryByPatient = new Map<string, Date>();
    for (const s of surgeries) {
      const prev = firstSurgeryByPatient.get(s.patientId);
      if (!prev || s.date < prev) firstSurgeryByPatient.set(s.patientId, s.date);
    }
    // Optional override anchor date
    const anchorOverride = cmd.surgeryDate ? new Date(cmd.surgeryDate) : null;

    const scalesByPatient = new Map<string, { date: Date; total: number }[]>();
    for (const sc of scales) {
      const arr = scalesByPatient.get(sc.patientId) ?? [];
      arr.push({ date: sc.date, total: sc.total });
      scalesByPatient.set(sc.patientId, arr);
    }

    const preValues: number[] = [];
    const postValues: number[] = [];

    for (const [patientId, scs] of scalesByPatient) {
      const anchor = anchorOverride ?? firstSurgeryByPatient.get(patientId);
      if (!anchor) continue;
      const pre = this.closestBefore(scs, anchor, preDays);
      const post = this.closestAfterWithin(scs, anchor, postDays);
      if (pre !== null && post !== null) {
        preValues.push(pre);
        postValues.push(post);
      }
    }

    if (preValues.length === 0) {
      return this.empty(cmd.studyId, cmd.scaleType, ['no patients with matching pre/post measurements within window']);
    }

    const meanPre = this.mean(preValues);
    const meanPost = this.mean(postValues);
    const meanDifference = meanPre - meanPost;
    const percentImprovement = meanPre !== 0 ? Math.round((meanDifference / meanPre) * 1000) / 10 : null;

    let wilcoxon: WilcoxonResult | null = null;
    let pValue = '—';
    const warnings: string[] = [];
    try {
      wilcoxon = await this.pythonStats.runWilcoxon(preValues, postValues);
      pValue = formatPValue(wilcoxon.pValue);
    } catch (err) {
      warnings.push(`wilcoxon_unavailable: ${(err as Error).message}`);
    }

    return {
      studyId: cmd.studyId,
      scaleType: cmd.scaleType,
      n: preValues.length,
      wilcoxon,
      pValue,
      meanPre: Math.round(meanPre * 100) / 100,
      meanPost: Math.round(meanPost * 100) / 100,
      meanDifference: Math.round(meanDifference * 100) / 100,
      percentImprovement,
      warnings,
    };
  }

  // ─────────────────────────────────────────────
  // Temporal matching helpers
  // ─────────────────────────────────────────────
  private closestBefore(scs: { date: Date; total: number }[], anchor: Date, windowDays: number): number | null {
    let best: number | null = null;
    let bestDiff = Infinity;
    for (const sc of scs) {
      const diff = (anchor.getTime() - sc.date.getTime()) / DAY_MS; // positive = before
      if (diff >= 0 && diff <= windowDays) {
        if (diff < bestDiff) { bestDiff = diff; best = sc.total; }
      }
    }
    return best;
  }

  private closestAfterWithin(scs: { date: Date; total: number }[], anchor: Date, windowDays: number): number | null {
    let best: number | null = null;
    let bestDiff = Infinity;
    for (const sc of scs) {
      const diff = Math.abs((sc.date.getTime() - anchor.getTime()) / DAY_MS); // post-surgery within ±window
      if (diff >= 0 && diff <= windowDays) {
        // Prefer the closest post-surgery measurement
        if (diff < bestDiff) { bestDiff = diff; best = sc.total; }
      }
    }
    return best;
  }

  private mean(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private empty(studyId: string, scaleType: string, warnings: string[]): PrePostResult {
    return {
      studyId,
      scaleType,
      n: 0,
      wilcoxon: null,
      pValue: '—',
      meanPre: null,
      meanPost: null,
      meanDifference: null,
      percentImprovement: null,
      warnings,
    };
  }
}