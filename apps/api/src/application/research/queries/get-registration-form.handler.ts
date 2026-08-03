// apps/api/src/application/research/queries/get-registration-form.handler.ts
// GetRegistrationFormHandler — maps a study's StudyVariable[] to a FormTemplate
// (REQ-FB-007) by delegating to the pure variableFormMapper. This reuses the
// consultations DynamicForm contract without forking it.

import { Injectable, Inject } from '@nestjs/common';
import type { FormTemplate } from '@medicore/contracts';
import { variableFormMapper } from '../services/variable-form-mapper';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

export interface GetRegistrationFormCommand {
  organizationId: string;
  studyId: string;
}

@Injectable()
export class GetRegistrationFormHandler {
  constructor(
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: GetRegistrationFormCommand): Promise<FormTemplate> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    const variables = await this.varRepo.findByStudy(cmd.studyId, cmd.organizationId);
    return variableFormMapper(study.id, study.name, variables);
  }
}