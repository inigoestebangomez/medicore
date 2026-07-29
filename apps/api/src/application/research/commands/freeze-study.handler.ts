// apps/api/src/application/research/commands/freeze-study.handler.ts
// Command handler: FreezeStudy (M8, BR-RES-009: only the owner can freeze;
// FROZEN is irreversible). Freezes the cohort → immutable.

import { Injectable, Inject } from '@nestjs/common';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError, StudyOwnershipError } from '@/domain/research/errors/study-not-found.error';

export interface FreezeStudyCommand {
  studyId: string;
  organizationId: string;
  userId: string;
}

@Injectable()
export class FreezeStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: FreezeStudyCommand): Promise<ResearchStudy> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    if (!study.isOwnedBy(cmd.userId)) throw new StudyOwnershipError(cmd.studyId, cmd.userId);
    const frozen = study.freeze(cmd.userId);
    return this.studyRepo.update(frozen);
  }
}