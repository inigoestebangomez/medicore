// apps/api/src/infrastructure/ai/structured-analysis/structured-analysis.provider.ts
// Strategy abstraction over AI-based Excel/CSV column-mapping proposals.
// Distinct from the existing AiProvider (ClinicalReportProvider) which deals in
// free-text report generation at temperature ~0.7. StructuredAnalysis providers
// return validated JSON at temperature 0 with structured proposals including
// a confidence score for the chain-of-responsibility orchestrator (AD-1).

import type { ColumnMappingProposal, FileSample } from '@medicore/contracts';

export type StructuredAnalysisProviderName = 'heuristic' | 'groq' | 'claude';

export const STRUCTURED_ANALYSIS = Symbol('STRUCTURED_ANALYSIS');

export interface StructuredAnalysisProvider {
  /** Stable provider name for audit/logging. */
  readonly name: StructuredAnalysisProviderName;
  /** Stable model identifier, e.g. "regex-heuristic-v1" or "llama-3-70b". */
  readonly modelName: string;
  /**
   * Analyze the file sample and return a typed column-mapping proposal. Each
   * provider is single-purpose; the chain orchestrator (ImportAnalyzerService)
   * decides whether to fall through to the next provider based on `confidence`.
   */
  analyzeStructure(sample: FileSample): Promise<ColumnMappingProposal>;
}