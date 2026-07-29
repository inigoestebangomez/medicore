// apps/api/src/application/research/queries/get-study.handler.ts
// Query handler: GetStudy — single study detail.

import { Injectable, Inject } from '@nestjs/common';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

export interface GetStudyCommand {
  studyId: string;
  organizationId: string;
}

@Injectable()
export class GetStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: GetStudyCommand): Promise<ResearchStudy> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    return study;
  }
}