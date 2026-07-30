// apps/api/src/application/research/queries/export-v3-status.handler.ts
import { Injectable } from '@nestjs/common';
import { ExportV3JobRegistry } from '../export/export-v3.job-registry';

export interface ExportV3StatusResult {
  jobId: string;
  status: 'done' | 'failed' | 'unknown';
  filename?: string;
  error?: string;
}

@Injectable()
export class ExportV3StatusHandler {
  constructor(private readonly registry: ExportV3JobRegistry) {}

  execute(jobId: string): ExportV3StatusResult {
    const job = this.registry.get(jobId);
    if (!job) return { jobId, status: 'unknown' };
    return { jobId, status: job.status, filename: job.filename, error: job.error };
  }
}