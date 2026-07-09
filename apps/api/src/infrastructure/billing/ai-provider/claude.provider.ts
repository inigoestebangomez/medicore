// apps/api/src/infrastructure/billing/ai-provider/claude.provider.ts
import { Injectable } from '@nestjs/common';
import { AnthropicService } from '@/infrastructure/ai/anthropic.service';
import type { AiProvider, ReportGenerationInput } from './ai-provider.interface';

/**
 * Wraps the existing AnthropicService behind the AiProvider strategy. The
 * heavy lifting (prompt building, SDK calls) stays in AnthropicService — this
 * is wrap-not-rewrite.
 */
@Injectable()
export class ClaudeProvider implements AiProvider {
  constructor(private readonly anthropic: AnthropicService) {}

  get modelName(): string {
    return process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
  }

  generateReport(input: ReportGenerationInput): Promise<string> {
    return this.anthropic.generateReport(input);
  }
}