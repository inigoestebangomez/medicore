// apps/api/src/application/research/commands/create-study.handler.ts
// Command handler: CreateStudy. Wraps an immutable ResearchQuery in a new
// DRAFT ResearchStudy (M8). Composition via FK queryId.

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import type { CreateStudyInput } from '@/domain/research/contracts/study.contract';

export interface CreateStudyCommand {
  organizationId: string;
  createdBy: string;
  input: CreateStudyInput;
}

@Injectable()
export class CreateStudyHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
  ) {}

  async execute(cmd: CreateStudyCommand): Promise<ResearchStudy> {
    const query = await this.queryRepo.findById(cmd.input.queryId, cmd.organizationId);
    if (!query) throw new ResearchQueryNotFoundError(cmd.input.queryId);

    const study = ResearchStudy.create({
      id: randomUUID(),
      organizationId: cmd.organizationId,
      createdBy: cmd.createdBy,
      queryId: cmd.input.queryId,
      name: cmd.input.name,
      description: cmd.input.description,
      publicationRef: cmd.input.publicationRef,
    });
    return this.studyRepo.create(study);
  }
}