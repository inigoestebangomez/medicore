// apps/api/src/application/research/commands/recalculate-study.handler.ts
// Command handler: RecalculateStudy (M8, BR-RES-008). Re-executes the study's
// origin ResearchQuery, refreshes cachedPatientIds/count/cachedAt. Blocked when
// the study is frozen (immutable cohort).

import { Injectable, Inject } from '@nestjs/common';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError, StudyStateError } from '@/domain/research/errors/study-not-found.error';
import { ExecuteResearchQueryHandler } from '../queries/execute-research-query.handler';

export interface RecalculateStudyCommand {
  studyId: string;
  organizationId: string;
}

@Injectable()
export class RecalculateStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    private readonly executeQuery: ExecuteResearchQueryHandler,
  ) {}

  async execute(cmd: RecalculateStudyCommand): Promise<ResearchStudy> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    if (study.status.isFrozen) throw new StudyStateError('Cannot recalculate a frozen study');
    // V4: FORM studies (no queryId) have no cohort to recalculate.
    if (!study.queryId) throw new StudyStateError('Only query-backed studies can be recalculated');

    const executed = await this.executeQuery.execute({
      queryId: study.queryId,
      organizationId: cmd.organizationId,
    });
    const patientIds = executed.rows.map((r) => r.patientId);
    const recalculated = study.recalculate(patientIds);
    return this.studyRepo.update(recalculated);
  }
}