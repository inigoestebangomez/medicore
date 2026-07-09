// apps/api/src/infrastructure/billing/ai-provider/ai-provider.interface.ts
// Strategy abstraction over AI report generation. Any provider plugs in via
// configuration (AI_PROVIDER env). Allows swapping Claude for Ollama or a
// local model without touching the use case layer.

import type { ReportGenerationInput } from '@/infrastructure/ai/anthropic.service';

export type { ReportGenerationInput };

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  /** Generate a clinical report for the given structured input. */
  generateReport(input: ReportGenerationInput): Promise<string>;
  /** Stable model identifier for audit logging (e.g. "claude-sonnet-4-20250514"). */
  readonly modelName: string;
}