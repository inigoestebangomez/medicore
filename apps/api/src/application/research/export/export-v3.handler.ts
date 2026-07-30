// apps/api/src/application/research/export/export-v3.handler.ts
// Orchestrates V3 export (M7): given a format list + assembled study data,
// generates each requested artifact (docx, tiff, csv, R syntax, SPSS syntax)
// and bundles them as ZIP when requested. Stores the result in the in-memory
// job registry under a random jobId and returns `{ jobId }`. Synchronous path
// (small exports) per the design — async BullMQ wiring can swap the handler
// body without changing the controller contract.
//
// Does NOT touch the V2 PDF/PNG pipeline (PdfProcessor, ExportV2Handler).

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DocxGenerator, type DocxRequest } from './docx.generator';
import { TiffConverter } from './tiff.converter';
import { ZipBundler, type ArchivePair } from './zip.bundler';
import {
  generateRSyntax, type RSynRequest, type RSupportedTest,
} from './r-syntax.generator';
import { generateSpssSyntax } from './spss-syntax.generator';
import { ExportV3JobRegistry } from './export-v3.job-registry';

export type ExportFormat = 'docx' | 'tiff' | 'csv' | 'r_syntax' | 'spss_syntax' | 'zip';

export interface ExportV3Request {
  studyName: string;
  formats: ExportFormat[];
  /** docx assembly payload */
  table1?: DocxRequest['table1'];
  comparison?: DocxRequest['comparison'];
  analyses?: DocxRequest['analyses'];
  style?: DocxRequest['style'];
  /** tiff input PNG (base64 or buffer) */
  png?: string | Buffer;
  /** raw CSV string for the csv format */
  csv?: string;
  /** list of performed tests driving the R/SPSS syntax */
  tests?: RSupportedTest[] | RSynRequest['tests'];
  testDetails?: RSynRequest['tests'];
}

export interface ExportV3Result {
  jobId: string;
  format: ExportFormat | 'zip';
  filename: string;
}

@Injectable()
export class ExportV3Handler {
  constructor(
    private readonly docx: DocxGenerator,
    private readonly tiff: TiffConverter,
    private readonly zip: ZipBundler,
    private readonly registry: ExportV3JobRegistry,
  ) {}

  async execute(req: ExportV3Request): Promise<ExportV3Result> {
    const artifacts: Map<ExportFormat, Buffer | string> = new Map();
    const testList = (req.testDetails ?? (req.tests ?? []).map((t) => ({ test: t as RSupportedTest }))) as RSynRequest['tests'];

    if (req.formats.includes('docx') || req.formats.includes('zip')) {
      const buf = await this.docx.generate({
        studyName: req.studyName,
        table1: req.table1,
        comparison: req.comparison,
        analyses: req.analyses,
        style: req.style,
      });
      artifacts.set('docx', buf);
    }
    if (req.formats.includes('tiff') || req.formats.includes('zip')) {
      const png = req.png ? (Buffer.isBuffer(req.png) ? req.png : Buffer.from(req.png, 'base64')) : null;
      if (png) artifacts.set('tiff', await this.tiff.convert(png));
    }
    if (req.formats.includes('csv') || req.formats.includes('zip')) {
      if (req.csv) artifacts.set('csv', req.csv);
    }
    if (req.formats.includes('r_syntax') || req.formats.includes('zip')) {
      artifacts.set('r_syntax', generateRSyntax({ studyName: req.studyName, tests: testList }));
    }
    if (req.formats.includes('spss_syntax') || req.formats.includes('zip')) {
      artifacts.set('spss_syntax', generateSpssSyntax({ studyName: req.studyName, tests: testList }));
    }

    const wantZip = req.formats.includes('zip');
    const isZip = wantZip && artifacts.size > 1;
    let buffer: Buffer;
    let filename: string;
    let mimeType: string;

    if (isZip) {
      const pairs: ArchivePair[] = [];
      const nameMap: Record<string, string> = {
        docx: 'table1.docx', tiff: 'figure.tiff', csv: 'table.csv',
        r_syntax: 'analysis.R', spss_syntax: 'analysis.sps',
      };
      for (const [fmt, payload] of artifacts) {
        pairs.push({ filename: nameMap[fmt] ?? `${fmt}.bin`, buffer: typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload });
      }
      buffer = await this.zip.bundle(pairs);
      filename = `${slug(req.studyName)}-export.zip`;
      mimeType = 'application/zip';
    } else {
      const single = req.formats.find((f) => artifacts.has(f)) ?? req.formats[0];
      const payload = artifacts.get(single) ?? null;
      if (payload == null) throw new Error(`format '${single}' produced no artifact (missing required input)`);
      if (typeof payload === 'string') buffer = Buffer.from(payload, 'utf-8');
      else buffer = payload;
      const extMap: Record<string, string> = { docx: 'docx', tiff: 'tiff', csv: 'csv', r_syntax: 'R', spss_syntax: 'sps' };
      filename = `${slug(req.studyName)}.${extMap[single] ?? 'bin'}`;
      mimeType = single === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : single === 'tiff' ? 'image/tiff'
        : single === 'csv' ? 'text/csv'
        : 'text/plain';
    }

    const jobId = randomUUID();
    this.registry.set({ id: jobId, status: 'done', filename, mimeType, buffer });
    return { jobId, format: isZip ? 'zip' : (req.formats.find((f) => artifacts.has(f)) ?? req.formats[0]), filename };
  }

  /** Convenience used by the download handler / controller. */
  getJob(jobId: string) { return this.registry.get(jobId); }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'research';
}