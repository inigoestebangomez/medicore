// apps/api/src/application/research/commands/archive-study.handler.ts
// Command handler: ArchiveStudy (M8). ACTIVE→ARCHIVED (pauses live updates).

import { Injectable, Inject } from '@nestjs/common';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

export interface ArchiveStudyCommand {
  studyId: string;
  organizationId: string;
}

@Injectable()
export class ArchiveStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: ArchiveStudyCommand): Promise<ResearchStudy> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    const archived = study.archive();
    return this.studyRepo.update(archived);
  }
}