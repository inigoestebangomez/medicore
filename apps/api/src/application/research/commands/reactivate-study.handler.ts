// apps/api/src/application/research/commands/reactivate-study.handler.ts
// Command handler: ReactivateStudy (M8). ARCHIVED→ACTIVE resumes a paused
// cohort's live updates. Idempotent on an already-ACTIVE study.

import { Injectable, Inject } from '@nestjs/common';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

export interface ReactivateStudyCommand {
  studyId: string;
  organizationId: string;
}

@Injectable()
export class ReactivateStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: ReactivateStudyCommand): Promise<ResearchStudy> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    const active = study.reactivate();
    return this.studyRepo.update(active);
  }
}