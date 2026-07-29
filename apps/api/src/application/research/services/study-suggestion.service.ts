// apps/api/src/application/research/services/study-suggestion.service.ts
// StudySuggestionService (M8). Deterministic heuristics analyzing a study's
// cohort to recommend next analytical steps:
//   - pre_post_available (≥10 patients with ≥2 measurements of same scaleType)
//   - group_comparison_recommended (categorical var with 2-4 values, ≥5/group)
//   - sufficient_followup (median lastScaleDate - surgeryDate > 180 days)
//   - regression_feasible (binary outcome, ≥10 events/predictor — BR-RES-010)
//   - table_one_recommended (new study without analyses)
//
// Analyzes cachedPatientIds by reading patient clinical data via Prisma.

import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import type { Suggestion, SuggestionType } from '@/domain/research/contracts/study.contract';

interface CohortSummary {
  total: number;
  scalesByType: Record<string, { patientIds: Set<string>; preOpCount: number; postOpCount: number }>;
  categorical: Array<{ field: string; categories: Map<string, number> }>;
  surgeryDates: Date[];
  lastScaleDates: Date[];
  binaryOutcomes: Record<string, number>;
}

const MIN_PRE_POST_PATIENTS = 10;
const MIN_GROUP_SIZE = 5;
const MIN_FOLLOWUP_DAYS = 180;
const MIN_EVENTS_PER_PREDICTOR = 10; // BR-RES-010

@Injectable()
export class StudySuggestionService {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly prisma: PrismaService,
  ) {}

  async analyze(studyId: string, organizationId: string): Promise<Suggestion[]> {
    const study = await this.studyRepo.findById(studyId, organizationId);
    if (!study) throw new StudyNotFoundError(studyId);

    const summary = await this.summarizeCohort(study.cachedPatientIds, organizationId);
    const suggestions: Suggestion[] = [];

    // table_one_recommended — new study without analyses
    if (!Array.isArray(study.analyses) || study.analyses.length === 0) {
      suggestions.push(this.suggest('table_one_recommended', 'New study with no analyses yet', 'POST /research/table1'));
    }

    // pre_post_available
    const prePost = Object.entries(summary.scalesByType).find(
      ([, v]) => v.patientIds.size >= MIN_PRE_POST_PATIENTS && v.preOpCount > 0 && v.postOpCount > 0,
    );
    if (prePost) {
      suggestions.push(
        this.suggest(
          'pre_post_available',
          `≥${MIN_PRE_POST_PATIENTS} patients with pre/post measurements of scale type ${prePost[0]}`,
          'POST /research/analysis/pre-post',
          { scaleType: prePost[0] },
        ),
      );
    }

    // group_comparison_recommended
    const groupable = summary.categorical.find((c) => {
      const valid = Array.from(c.categories.entries()).filter(([, n]) => n >= MIN_GROUP_SIZE);
      return valid.length >= 2 && valid.length <= 4;
    });
    if (groupable) {
      suggestions.push(
        this.suggest(
          'group_comparison_recommended',
          `Categorical variable "${groupable.field}" with 2-4 groups of ≥${MIN_GROUP_SIZE} patients`,
          'POST /research/analysis/compare-groups',
          { groupBy: groupable.field },
        ),
      );
    }

    // sufficient_followup
    if (summary.surgeryDates.length > 0 && summary.lastScaleDates.length > 0) {
      const followups = [];
      for (const surgery of summary.surgeryDates) {
        for (const last of summary.lastScaleDates) {
          if (last > surgery) followups.push((last.getTime() - surgery.getTime()) / (24 * 3600 * 1000));
        }
      }
      if (followups.length > 0) {
        const median = this.median(followups);
        if (median > MIN_FOLLOWUP_DAYS) {
          suggestions.push(
            this.suggest('sufficient_followup', `Median follow-up ${Math.round(median)} days > ${MIN_FOLLOWUP_DAYS}`, undefined),
          );
        }
      }
    }

    // regression_feasible (BR-RES-010)
    for (const [outcome, events] of Object.entries(summary.binaryOutcomes)) {
      if (events >= MIN_EVENTS_PER_PREDICTOR) {
        suggestions.push(
          this.suggest(
            'regression_feasible',
            `Binary outcome "${outcome}" with ${events} events (≥${MIN_EVENTS_PER_PREDICTOR}/predictor, BR-RES-010)`,
            'POST /research/stats/inferential',
          ),
        );
        break;
      }
    }

    return suggestions;
  }

  private suggest(
    type: SuggestionType,
    rationale: string,
    recommendedEndpoint?: string,
    previewParams?: Record<string, unknown>,
  ): Suggestion {
    return {
      id: `${type}-${Date.now().toString(36)}`,
      type,
      rationale,
      recommendedEndpoint,
      previewParams,
    };
  }

  private async summarizeCohort(
    patientIds: string[],
    organizationId: string,
  ): Promise<CohortSummary> {
    const summary: CohortSummary = {
      total: patientIds.length,
      scalesByType: {},
      categorical: [],
      surgeryDates: [],
      lastScaleDates: [],
      binaryOutcomes: {},
    };
    if (patientIds.length === 0) return summary;

    // Fetch scales grouped by patient + scaleType
    const scales = await this.prisma.clinicalScale.findMany({
      where: { organizationId, patientId: { in: patientIds }, deletedAt: null },
      select: { patientId: true, scaleType: true, date: true },
    });
    const surgeries = await this.prisma.surgery.findMany({
      where: { organizationId, patientId: { in: patientIds }, deletedAt: null },
      select: { patientId: true, date: true, outcome: true, complications: true },
    });

    // Per-patient first surgery date (anchor) + last scale date
    const firstSurgeryByPatient = new Map<string, Date>();
    const lastScaleByPatient = new Map<string, Date>();
    for (const s of surgeries) {
      const prev = firstSurgeryByPatient.get(s.patientId);
      if (!prev || s.date < prev) firstSurgeryByPatient.set(s.patientId, s.date);
    }
    for (const sc of scales) {
      const prev = lastScaleByPatient.get(sc.patientId);
      if (!prev || sc.date > prev) lastScaleByPatient.set(sc.patientId, sc.date);
    }

    // Scales by type with pre/post counts
    const scalesByPatientType = new Map<string, Set<string>>();
    const prePostByType = new Map<string, { pre: number; post: number }>();
    for (const sc of scales) {
      const key = sc.scaleType;
      let set = scalesByPatientType.get(key);
      if (!set) { set = new Set(); scalesByPatientType.set(key, set); }
      set.add(sc.patientId);
      const surgery = firstSurgeryByPatient.get(sc.patientId);
      const bucket = prePostByType.get(key) ?? { pre: 0, post: 0 };
      if (surgery) {
        if (sc.date < surgery) bucket.pre++;
        else bucket.post++;
      }
      prePostByType.set(key, bucket);
    }
    for (const [type, set] of scalesByPatientType) {
      const bucket = prePostByType.get(type) ?? { pre: 0, post: 0 };
      summary.scalesByType[type] = { patientIds: set, preOpCount: bucket.pre, postOpCount: bucket.post };
    }

    // Categorical: surgery status, complications presence, sex-based grouping
    const complicationCounts = new Map<string, number>([['yes', 0], ['no', 0]]);
    for (const s of surgeries) {
      if (s.complications) complicationCounts.set('yes', (complicationCounts.get('yes') ?? 0) + 1);
      else complicationCounts.set('no', (complicationCounts.get('no') ?? 0) + 1);
    }
    summary.categorical.push({ field: 'complications', categories: complicationCounts });

    // Surgery dates + last scale dates for follow-up
    summary.surgeryDates = Array.from(firstSurgeryByPatient.values());
    summary.lastScaleDates = Array.from(lastScaleByPatient.values());

    // Binary outcomes: exitus/reintervention count
    let exitusEvents = 0;
    for (const s of surgeries) {
      const outcome = (s.outcome ?? '').toLowerCase();
      if (outcome.includes('exitus') || outcome.includes('fallec')) exitusEvents++;
    }
    if (exitusEvents > 0) summary.binaryOutcomes['exitus'] = exitusEvents;

    return summary;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
}