// apps/api/src/application/import/services/import-analyzer.service.ts
// Chain-of-responsibility orchestrator for the StructuredAnalysis providers.
// Iterates [Heuristic, Groq, Claude] in fixed order and stops at the first
// provider whose confidence ≥ CONFIDENCE_THRESHOLD (0.7). Each provider is
// single-purpose; this service owns the "stop" policy (AD-2).
//
// Failure handling: heuristic never throws; Groq/Claude may throw when the
// API key is missing or the request fails — the orchestrator catches, logs,
// and falls through to the next provider. If every AI provider fails, the
// heuristic result is returned even if it's below threshold (safe fallback —
// the physician still gets a mapping to review in the UI).

import { Injectable, Logger } from '@nestjs/common';
import type { ColumnMappingProposal, FileSample } from '@medicore/contracts';
import type { StructuredAnalysisProvider } from '@/infrastructure/ai/structured-analysis/structured-analysis.provider';

export const ANALYSIS_CONFIDENCE_THRESHOLD = 0.7;

export interface AnalyzeResult {
  proposal: ColumnMappingProposal;
  /** Final provider that produced the proposal. */
  provider: string;
  /** Whether the chain stopped because the threshold was met. */
  metThreshold: boolean;
  /** Per-provider outcomes for audit/logging. */
  attempted: Array<{ provider: string; success: boolean; confidence?: number; error?: string }>;
}

@Injectable()
export class ImportAnalyzerService {
  private readonly logger = new Logger(ImportAnalyzerService.name);

  constructor(
    private readonly heuristic: StructuredAnalysisProvider,
    private readonly groq: StructuredAnalysisProvider,
    private readonly claude: StructuredAnalysisProvider,
  ) {}

  /**
   * Run the chain and return the best proposal. Always returns a proposal —
   * the heuristic is always run and is the safe fallback.
   */
  async analyzeWithFallback(sample: FileSample): Promise<AnalyzeResult> {
    const chain: StructuredAnalysisProvider[] = [this.heuristic, this.groq, this.claude];
    const attempted: AnalyzeResult['attempted'] = [];
    let bestHeuristic: ColumnMappingProposal | null = null;

    for (const provider of chain) {
      try {
        if (provider.name !== 'heuristic' && typeof (provider as any).isAvailable === 'function' && !(provider as any).isAvailable()) {
          attempted.push({ provider: provider.name, success: false, error: 'provider not configured (no API key)' });
          continue;
        }
        const proposal = await provider.analyzeStructure(sample);
        attempted.push({ provider: provider.name, success: true, confidence: proposal.confidence });

        if (provider.name === 'heuristic') {
          bestHeuristic = proposal;
          // Heuristic ≥ threshold → stop (covers ~80% of files).
          if (proposal.confidence >= ANALYSIS_CONFIDENCE_THRESHOLD) {
            return { proposal, provider: provider.name, metThreshold: true, attempted };
          }
        } else {
          // AI provider above threshold → use it and stop.
          if (proposal.confidence >= ANALYSIS_CONFIDENCE_THRESHOLD) {
            return { proposal, provider: provider.name, metThreshold: true, attempted };
          }
          // Below threshold but successful — keep going, but remember the best
          // so far (prefer AI over raw heuristic when both are below threshold).
          bestHeuristic = proposal;
        }
      } catch (err) {
        attempted.push({ provider: provider.name, success: false, error: (err as Error).message });
        this.logger.warn(`Provider "${provider.name}" failed: ${(err as Error).message}`);
        // Fall through to next provider.
      }
    }

    // No provider met the threshold. Return the heuristic result (or the best
    // fallback we got) — the physician still reviews the mapping in the UI.
    const fallback = bestHeuristic ?? this.emptyProposal(sample);
    return { proposal: fallback, provider: 'heuristic', metThreshold: false, attempted };
  }

  private emptyProposal(sample: FileSample): ColumnMappingProposal {
    // When even the heuristic somehow produces nothing usable, return a
    // conservative proposal that maps every column to "custom".
    const mapping: Record<string, 'custom'> = {};
    for (const col of sample.columns) mapping[col] = 'custom';
    return {
      columnMapping: mapping,
      customFieldNames: {},
      junkRowIndices: [],
      issues: ['No analyzer produced a confidence ≥ threshold; defaulting all columns to custom for physician review.'],
      confidence: 0,
      notes: 'Fallback proposal — review carefully.',
      provider: 'heuristic',
    };
  }
}