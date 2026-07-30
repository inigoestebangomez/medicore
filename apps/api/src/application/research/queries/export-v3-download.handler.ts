// apps/api/src/application/research/queries/export-v3-download.handler.ts
import { Injectable } from '@nestjs/common';
import { ExportV3JobRegistry } from '../export/export-v3.job-registry';

export interface ExportV3DownloadResult {
  ok: boolean;
  buffer?: Buffer;
  filename?: string;
  mimeType?: string;
}

@Injectable()
export class ExportV3DownloadHandler {
  constructor(private readonly registry: ExportV3JobRegistry) {}

  execute(jobId: string): ExportV3DownloadResult {
    const job = this.registry.get(jobId);
    if (!job) return { ok: false };
    return { ok: true, buffer: job.buffer, filename: job.filename, mimeType: job.mimeType };
  }
}