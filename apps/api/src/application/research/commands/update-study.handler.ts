// apps/api/src/application/research/commands/update-study.handler.ts
// Command handler: UpdateStudy — metadata only (name/description/analyses/publicationRef).
// Cohort data is mutated only through activate/freeze/recalculate, never via this handler.

import { Injectable, Inject } from '@nestjs/common';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError, StudyStateError } from '@/domain/research/errors/study-not-found.error';
import type { UpdateStudyInput } from '@/domain/research/contracts/study.contract';

export interface UpdateStudyCommand {
  studyId: string;
  organizationId: string;
  input: UpdateStudyInput;
}

@Injectable()
export class UpdateStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: UpdateStudyCommand): Promise<ResearchStudy> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);

    if (study.status.isFrozen) {
      throw new StudyStateError('Cannot edit a frozen study (immutable cohort)');
    }

    let updated = study;
    if (cmd.input.name !== undefined) updated = updated.rename(cmd.input.name, cmd.input.description ?? undefined);
    else if (cmd.input.description !== undefined) updated = updated.rename(updated.name, cmd.input.description);
    if (cmd.input.publicationRef !== undefined) {
      updated = updated.setPublicationRef(cmd.input.publicationRef);
    }
    if (cmd.input.analyses !== undefined) updated = updated.updateAnalyses(cmd.input.analyses);

    return this.studyRepo.update(updated as ResearchStudy);
  }
}