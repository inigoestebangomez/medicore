// apps/api/src/application/research/export/export-v3.job-registry.ts
// In-memory job registry for Export V3 (M7). Maps jobId → {status, buffer,
// filename, error}. Used by the synchronous export handler. A BullMQ-backed
// implementation could replace this later — the synchronous path satisfies
// the small-export requirement.

import { Injectable } from '@nestjs/common';

export interface ExportV3Job {
  id: string;
  status: 'done' | 'failed';
  filename: string;
  mimeType: string;
  buffer?: Buffer;
  error?: string;
}

@Injectable()
export class ExportV3JobRegistry {
  private readonly jobs = new Map<string, ExportV3Job>();

  set(job: ExportV3Job): void { this.jobs.set(job.id, job); }
  get(id: string): ExportV3Job | undefined { return this.jobs.get(id); }
  delete(id: string): void { this.jobs.delete(id); }
}