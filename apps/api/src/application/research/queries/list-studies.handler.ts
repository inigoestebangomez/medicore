// apps/api/src/application/research/queries/list-studies.handler.ts
// Query handler: ListStudies — paginated, optionally filtered by status.

import { Injectable, Inject } from '@nestjs/common';
import type {
  IResearchStudyRepository,
  Paginated,
} from '@/domain/research/ports/research-study.repository.interface';
import { ResearchStudy } from '@/domain/research/research-study.entity';

export interface ListStudiesCommand {
  organizationId: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'FROZEN';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListStudiesHandler {
  constructor(
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: ListStudiesCommand): Promise<Paginated<ResearchStudy>> {
    return this.studyRepo.findByOrganization(cmd.organizationId, {
      status: cmd.status,
      page: cmd.page,
      pageSize: cmd.pageSize,
    });
  }
}