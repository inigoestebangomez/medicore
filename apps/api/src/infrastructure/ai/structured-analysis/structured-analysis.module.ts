// apps/api/src/infrastructure/ai/structured-analysis/structured-analysis.module.ts
import { Module } from '@nestjs/common';
import { HeuristicAnalyzer } from './heuristic-analyzer.provider';
import { GroqAnalyzer } from './groq-analyzer.provider';
import { ClaudeStructuredAnalyzer } from './claude-analyzer.provider';

/**
 * Registers the StructuredAnalysisProvider chain. Each provider checks
 * availability at construction time (API key presence). The orchestrator in
 * ImportAnalyzerService iterates them in order and stops at confidence ≥ 0.7.
 * Order is fixed: Heuristic (free) → Groq (Llama 3, free tier) → Claude (paid).
 */
@Module({
  providers: [
    { provide: 'HEURISTIC_ANALYZER', useClass: HeuristicAnalyzer },
    { provide: 'GROQ_ANALYZER', useClass: GroqAnalyzer },
    { provide: 'CLAUDE_STRUCTURED_ANALYZER', useClass: ClaudeStructuredAnalyzer },
  ],
  exports: [
    'HEURISTIC_ANALYZER',
    'GROQ_ANALYZER',
    'CLAUDE_STRUCTURED_ANALYZER',
  ],
})
export class StructuredAnalysisModule {}