// apps/api/src/application/research/services/study-lifecycle.service.ts
// StudyLifecycleService (M8, BR-RES-008). After an import completion event,
// find ACTIVE studies with stale cache (>6h), recalculate their cohort, and
// create a StudyNotification per (study, owner) when patientIds changed.
//
// Triggered by the import pipeline (BullMQ `import.completion` event). The
// service is synchronous here; the queue caller dispatches async.

import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StudyNotification } from '@/domain/research/study-notification.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import type { IStudyNotificationRepository } from '@/domain/research/ports/study-notification.repository.interface';
import { ExecuteResearchQueryHandler } from '../queries/execute-research-query.handler';

const STALE_HOURS = 6;

export interface RecalculateResult {
  studyId: string;
  previousCount: number;
  newCount: number;
  newPatientCount: number;
  notificationCreated: boolean;
}

@Injectable()
export class StudyLifecycleService {
  private readonly logger = new Logger(StudyLifecycleService.name);

  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    @Inject('IStudyNotificationRepository') private readonly notifRepo: IStudyNotificationRepository,
    private readonly executeQuery: ExecuteResearchQueryHandler,
  ) {}

  /**
   * Recalculate all stale ACTIVE studies for an org after an import completion.
   * Creates notifications when the cohort grew (new patients).
   */
  async recalculateStaleStudies(
    organizationId: string,
    _importBatchId: string,
  ): Promise<RecalculateResult[]> {
    const studies = await this.studyRepo.findActiveWithStaleCache(organizationId, STALE_HOURS);
    const results: RecalculateResult[] = [];

    for (const study of studies) {
      try {
        const res = await this.recalculateOne(organizationId, study);
        results.push(res);
      } catch (err) {
        this.logger.warn(`Recalc failed for study ${study.id}: ${(err as Error).message}`);
      }
    }
    return results;
  }

  private async recalculateOne(
    organizationId: string,
    study: import('@/domain/research/research-study.entity').ResearchStudy,
  ): Promise<RecalculateResult> {
    const previousIds = new Set(study.cachedPatientIds);
    const executed = await this.executeQuery.execute({
      queryId: study.queryId,
      organizationId,
    });
    const newIds = executed.rows.map((r) => r.patientId);
    const recalculated = study.recalculate(newIds);
    await this.studyRepo.update(recalculated);

    const newPatientIds = newIds.filter((id) => !previousIds.has(id));
    const newPatientCount = newPatientIds.length;

    let notificationCreated = false;
    if (newPatientCount > 0) {
      await this.notifRepo.create(
        new StudyNotification({
          id: randomUUID(),
          studyId: study.id,
          organizationId,
          userId: study.createdBy,
          newPatientCount,
        }),
      );
      notificationCreated = true;
    }

    return {
      studyId: study.id,
      previousCount: study.patientCount,
      newCount: newIds.length,
      newPatientCount,
      notificationCreated,
    };
  }
}