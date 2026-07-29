// apps/api/src/application/research/commands/pre-post-analysis.handler.ts
// Command handler: PrePostAnalysis (M3). Delegates to PrePostAnalysisService.

import { Injectable } from '@nestjs/common';
import { PrePostAnalysisService, type PrePostCommand, type PrePostResult } from '../services/pre-post-analysis.service';

export type { PrePostCommand } from '../services/pre-post-analysis.service';

@Injectable()
export class PrePostAnalysisHandler {
  constructor(private readonly prePostService: PrePostAnalysisService) {}

  async execute(cmd: PrePostCommand): Promise<PrePostResult> {
    return this.prePostService.analyze(cmd);
  }
}