// apps/api/src/infrastructure/ai/structured-analysis/structured-analysis.module.ts
import { Module } from '@nestjs/common';
import { HeuristicAnalyzer } from './heuristic-analyzer.provider';

/**
 * Registers StructuredAnalysisProvider implementations. Each provider checks
 * availability at construction time (API key presence). The orchestrator in
 * ImportAnalyzerService iterates them in order and stops at confidence ≥ 0.7.
 *
 * Phase 11 WU-11-03 starts with the HeuristicAnalyzer only. Groq/Claude
 * providers are added in WU-11-04.
 */
@Module({
  providers: [{ provide: 'HEURISTIC_ANALYZER', useClass: HeuristicAnalyzer }],
  exports: ['HEURISTIC_ANALYZER'],
})
export class StructuredAnalysisModule {}