// apps/api/src/application/research/queries/get-suggestions.handler.ts
// Query handler: GetSuggestions — delegates to StudySuggestionService.

import { Injectable } from '@nestjs/common';
import { StudySuggestionService } from '../services/study-suggestion.service';
import type { Suggestion } from '@/domain/research/contracts/study.contract';
import { GetStudyHandler } from './get-study.handler';

export interface GetSuggestionsCommand {
  studyId: string;
  organizationId: string;
}

@Injectable()
export class GetSuggestionsHandler {
  constructor(
    private readonly suggestionService: StudySuggestionService,
    private readonly getStudy: GetStudyHandler,
  ) {}

  async execute(cmd: GetSuggestionsCommand): Promise<{ studyId: string; suggestions: Suggestion[] }> {
    // Ensure the study exists + is accessible (throws StudyNotFoundError)
    await this.getStudy.execute({ studyId: cmd.studyId, organizationId: cmd.organizationId });
    const suggestions = await this.suggestionService.analyze(cmd.studyId, cmd.organizationId);
    return { studyId: cmd.studyId, suggestions };
  }
}