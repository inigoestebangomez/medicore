// apps/api/src/application/import/handlers/analyze-columns.handler.ts
// Lets the physician re-run the analyzer on a batch that's still CONFIRMING
// (e.g. after noticing the heuristic mapping is wrong and hoping an AI provider
// does better). Loads the batch, re-analyzes the cached sample, updates the
// proposal. Does not touch Patient records (BR-IMP-001).

import { Injectable, Inject } from '@nestjs/common';
import type { ColumnMappingProposal } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import { ImportAnalyzerService } from '../services/import-analyzer.service';
import type { IParsedFileCache } from '../ports/parsed-file-cache.port';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';

export interface AnalyzeColumnsCommand {
  batchId: string;
  organizationId: string;
}

export interface AnalyzeColumnsResult {
  batchId: string;
  proposal: ColumnMappingProposal;
  provider: string;
  metThreshold: boolean;
}

@Injectable()
export class AnalyzeColumnsHandler {
  constructor(
    private readonly analyzer: ImportAnalyzerService,
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    @Inject('IParsedFileCache') private readonly cache: IParsedFileCache,
  ) {}

  async execute(cmd: AnalyzeColumnsCommand): Promise<AnalyzeColumnsResult> {
    const batch = await this.batchRepo.findById(cmd.batchId, cmd.organizationId);
    if (!batch) throw new ImportBatchNotFoundError(cmd.batchId);

    // Prefer the cached full sample; fall back to the persisted sample.
    const cached = await this.cache.get(cmd.batchId, cmd.organizationId);
    const sample = cached?.sample ?? batch.sample;

    const { proposal, provider, metThreshold } = await this.analyzer.analyzeWithFallback(sample);

    const confirming = batch.toConfirming({
      columnMapping: proposal.columnMapping,
      customFieldNames: proposal.customFieldNames,
      junkRowIndices: proposal.junkRowIndices,
      aiConfidence: proposal.confidence,
      aiProvider: proposal.provider as 'heuristic' | 'groq' | 'claude' | null,
      issues: proposal.issues,
      notes: proposal.notes,
    });
    await this.batchRepo.updateAnalysis(cmd.batchId, cmd.organizationId, {
      columnMapping: confirming.columnMapping,
      customFieldNames: confirming.customFieldNames,
      junkRowIndices: confirming.junkRowIndices,
      aiConfidence: confirming.aiConfidence,
      aiProvider: confirming.aiProvider,
      issues: confirming.issues,
      notes: confirming.notes,
    });

    return { batchId: cmd.batchId, proposal, provider, metThreshold };
  }
}
