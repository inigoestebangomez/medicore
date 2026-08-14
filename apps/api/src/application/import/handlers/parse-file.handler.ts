// apps/api/src/application/import/handlers/parse-file.handler.ts
// Stage 1 entry point. Receives the uploaded buffer, parses it, creates a
// PENDING ImportBatch, caches the parsed file for later stages (AD-6: raw
// buffer is never persisted to the DB), runs the analyzer chain, and moves
// the batch to CONFIRMING with the proposed mapping.
//
// BR-IMP-001: nothing touches Patient records here — the batch starts PENDING
// and only becomes CONFIRMING with a proposal the physician must review.

import { randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import type { ColumnMappingProposal, FileSample } from '@medicore/contracts';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import { ImportBatch } from '@/domain/import/import-batch.entity';
import { FileParserService } from '../services/file-parser.service';
import { ImportAnalyzerService } from '../services/import-analyzer.service';
import type { IParsedFileCache } from '../ports/parsed-file-cache.port';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';

export interface ParseFileCommand {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  organizationId: string;
  createdBy: string;
}

export interface ParseFileResult {
  batchId: string;
  fileName: string;
  originalFormat: 'xlsx' | 'csv' | 'tsv';
  totalRows: number;
  fileHash: string;
  sample: FileSample;
  proposal: ColumnMappingProposal;
  provider: string;
}

@Injectable()
export class ParseFileHandler {
  constructor(
    private readonly parser: FileParserService,
    private readonly analyzer: ImportAnalyzerService,
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    @Inject('IParsedFileCache') private readonly cache: IParsedFileCache,
  ) {}

  async execute(cmd: ParseFileCommand): Promise<ParseFileResult> {
    const { parsed, fileHash, fileSize } = this.parser.parse({
      buffer: cmd.buffer,
      fileName: cmd.fileName,
      mimeType: cmd.mimeType,
    });

    const batchId = randomUUID();
    const pending = ImportBatch.createPending({
      id: batchId,
      organizationId: cmd.organizationId,
      createdBy: cmd.createdBy,
      fileName: cmd.fileName,
      fileSize,
      fileHash,
      originalFormat: parsed.originalFormat,
      sample: parsed.sample,
      normalizedRows: parsed.rows,
      totalRows: parsed.totalRows,
    });
    await this.batchRepo.persist(pending);
    await this.cache.set(batchId, cmd.organizationId, parsed);

    const { proposal, provider } = await this.analyzer.analyzeWithFallback(parsed.sample);

    const persisted = await this.batchRepo.findById(batchId, cmd.organizationId);
    if (!persisted) throw new ImportBatchNotFoundError(batchId);
    const confirming = persisted.toConfirming({
      columnMapping: proposal.columnMapping,
      customFieldNames: proposal.customFieldNames,
      junkRowIndices: proposal.junkRowIndices,
      aiConfidence: proposal.confidence,
      aiProvider: proposal.provider as 'heuristic' | 'groq' | 'claude' | null,
      issues: proposal.issues,
      notes: proposal.notes,
      skippedRows: 0,
    });
    await this.batchRepo.updateAnalysis(batchId, cmd.organizationId, {
      columnMapping: confirming.columnMapping,
      customFieldNames: confirming.customFieldNames,
      junkRowIndices: confirming.junkRowIndices,
      ignoredRows: confirming.ignoredRows,
      aiConfidence: confirming.aiConfidence,
      aiProvider: confirming.aiProvider,
      issues: confirming.issues,
      notes: confirming.notes,
    });

    return {
      batchId,
      fileName: cmd.fileName,
      originalFormat: parsed.originalFormat,
      totalRows: parsed.totalRows,
      fileHash,
      sample: parsed.sample,
      proposal,
      provider,
    };
  }
}
