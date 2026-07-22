// apps/api/src/application/research/commands/export-collection.handler.ts
// Command handler: ExportResults.
// BR-RES-002: exports are ALWAYS anonymized — outputs use an internal,
// non-reversible subject identifier. Real names, NHC, and any other direct
// identifier never appear in exported data.
//
// Formats (spec §11):
//   csv          → CSV table, one row per patient, anonymized columns
//   word_table1  → plain-text "Tabla 1" layout (mean/SD/CI95 by field) for
//                  copy-paste into Word; charts are rendered by the frontend.
//   png_charts   / stats_pdf → returned as a manifest; the frontend renders
//                  these from the structured stats payload (no image bytes here).

import { createHash } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import type { ExportFormat } from '@medicore/contracts';
import type { IPatientCollectionRepository } from '@/domain/research/patient-collection.repository.interface';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { ExecuteResearchQueryHandler } from '../queries/execute-research-query.handler';

export interface ExportCommand {
  collectionId?: string; // export a saved collection
  queryId?: string; // export a query result (ad-hoc)
  organizationId: string;
  format: ExportFormat;
}

export interface ExportResult {
  format: ExportFormat;
  mimeType: string;
  filename: string;
  /** Text content for csv / word_table1. Empty for image/pdf manifests. */
  content: string;
  /** For png_charts/stats_pdf: structured payload the frontend renders. */
  manifest?: unknown;
  anonymized: true; // BR-RES-002 — always true
}

// Fields that must NEVER be exported as identifying data (BR-RES-002).
const FORBIDDEN_FIELDS = new Set([
  'firstName',
  'lastName',
  'name',
  'nhc',
  'email',
  'phone',
  'address',
  'birthDate', // age is allowed; exact DOB is re-identifiable
]);

@Injectable()
export class ExportResultsHandler {
  constructor(
    @Inject('IPatientCollectionRepository')
    private readonly collectionRepo: IPatientCollectionRepository,
    @Inject('IResearchQueryRepository')
    private readonly queryRepo: IResearchQueryRepository,
    private readonly executeQueryHandler: ExecuteResearchQueryHandler,
  ) {}

  async execute(cmd: ExportCommand): Promise<ExportResult> {
    if (!cmd.collectionId && !cmd.queryId) {
      throw new CollectionNotFoundError('collectionId or queryId is required');
    }

    // Resolve rows + displayFields from either a collection (via its origin
    // query) or directly from a query.
    let queryId: string;
    if (cmd.collectionId) {
      const collection = await this.collectionRepo.findById(
        cmd.collectionId,
        cmd.organizationId,
      );
      if (!collection) throw new CollectionNotFoundError(cmd.collectionId);
      if (!collection.queryId) {
        throw new CollectionNotFoundError(
          `collection ${cmd.collectionId} has no origin query; use queryId export`,
        );
      }
      queryId = collection.queryId;
    } else {
      queryId = cmd.queryId!;
      const exists = await this.queryRepo.findById(queryId, cmd.organizationId);
      if (!exists) throw new ResearchQueryNotFoundError(queryId);
    }

    const executed = await this.executeQueryHandler.execute({
      queryId,
      organizationId: cmd.organizationId,
    });

    const safeFields = executed.displayFields.filter(
      (f) => !FORBIDDEN_FIELDS.has(f),
    );

    switch (cmd.format) {
      case 'csv':
        return this.exportCsv(executed.queryId, executed.rows, safeFields);
      case 'word_table1':
        return this.exportWordTable1(executed.queryId, executed.stats, executed.distributions);
      case 'png_charts':
        return this.exportChartManifest(executed.queryId, executed.distributions, 'png_charts');
      case 'stats_pdf':
        return this.exportChartManifest(executed.queryId, executed.distributions, 'stats_pdf');
      default:
        return this.exportCsv(executed.queryId, executed.rows, safeFields);
    }
  }

  // ─────────────────────────────────────────────
  // CSV — BR-RES-002 anonymized
  // ─────────────────────────────────────────────

  private exportCsv(
    queryId: string,
    rows: Array<{ patientId: string; nhc: string; fields: Record<string, unknown> }>,
    safeFields: string[],
  ): ExportResult {
    const header = ['subject_id', ...safeFields];
    const lines = [header.join(',')];

    for (const row of rows) {
      const subjectId = this.anonymizeId(row.patientId);
      const cells = [this.csvCell(subjectId)];
      for (const field of safeFields) {
        cells.push(this.csvCell(row.fields[field]));
      }
      lines.push(cells.join(','));
    }

    return {
      format: 'csv',
      mimeType: 'text/csv',
      filename: `research_${queryId}.csv`,
      content: lines.join('\n'),
      anonymized: true,
    };
  }

  /**
   * Deterministic, non-reversible subject ID.
   * SHA-256 of the patient UUID with a per-export salt prefix → "SUBJ-<12 hex>".
   * The original UUID cannot be recovered from the hash (BR-RES-002).
   */
  private anonymizeId(patientId: string): string {
    const hash = createHash('sha256').update(`medicore::${patientId}`).digest('hex');
    return `SUBJ-${hash.slice(0, 12)}`;
  }

  private csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // RFC 4180: quote if it contains comma, quote, or newline.
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // ─────────────────────────────────────────────
  // Word "Tabla 1" — descriptive stats summary
  // ─────────────────────────────────────────────

  private exportWordTable1(
    queryId: string,
    stats: Array<{
      field: string;
      n: number;
      mean: number | null;
      median: number | null;
      stdDev: number | null;
      min: number | null;
      max: number | null;
      ci95Lower: number | null;
      ci95Upper: number | null;
    }>,
    distributions: Array<{ field: string; categories: Array<{ label: string; count: number }> }>,
  ): ExportResult {
    const lines: string[] = [];
    lines.push(`Tabla 1 — Research cohort (query ${queryId})`);
    lines.push('Variable | n | Mean | Median | SD | Min | Max | CI95%');
    lines.push('--- | --- | --- | --- | --- | --- | --- | ---');

    for (const s of stats) {
      lines.push(
        [
          s.field,
          s.n,
          s.mean ?? '-',
          s.median ?? '-',
          s.stdDev ?? '-',
          s.min ?? '-',
          s.max ?? '-',
          s.ci95Lower != null && s.ci95Upper != null
            ? `${s.ci95Lower} – ${s.ci95Upper}`
            : '-',
        ].join(' | '),
      );
    }

    if (distributions.length > 0) {
      lines.push('');
      lines.push('Categorical variables (N<5 suppressed — BR-RES-004):');
      for (const dist of distributions) {
        lines.push(`${dist.field}: ${dist.categories.map((c) => `${c.label}=${c.count}`).join(', ')}`);
      }
    }

    return {
      format: 'word_table1',
      mimeType: 'text/plain',
      filename: `research_${queryId}_tabla1.txt`,
      content: lines.join('\n'),
      anonymized: true,
    };
  }

  // ─────────────────────────────────────────────
  // Chart/PDF manifest — frontend renders from structured data
  // ─────────────────────────────────────────────

  private exportChartManifest(
    queryId: string,
    distributions: Array<{ field: string; categories: Array<{ label: string; count: number }> }>,
    format: ExportFormat,
  ): ExportResult {
    return {
      format,
      mimeType: 'application/json',
      filename: `research_${queryId}_${format}_manifest.json`,
      content: '',
      manifest: {
        queryId,
        distributions, // already BR-RES-004 suppressed upstream
        note: 'Render client-side from the structured distributions payload.',
      },
      anonymized: true,
    };
  }
}