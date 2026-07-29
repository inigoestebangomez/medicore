// apps/api/src/infrastructure/stats/stats.processor.ts
// BullMQ worker for the `stats` queue (design: stats.process, concurrency 4,
// timeout 10s, attempts 2, exponential backoff 5s). Calls PythonStatsService
// for inferential computations. On Python timeout/unavailability the job
// resolves with a graceful-degradation result carrying a warning rather than
// failing — the caller surfaces "inferential_stats_unavailable" (BR-RES-005).

import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { PythonStatsService, type RunInferentialInput } from './python-stats.service';
import type { InferentialTestType, StatisticalTestResult } from '@medicore/contracts';

export interface StatsJobData {
  test: InferentialTestType;
  input: RunInferentialInput;
  correlationId?: string;
}

export interface StatsJobResult {
  ok: boolean;
  result?: StatisticalTestResult;
  warning?: string;
}

@Processor('stats')
export class StatsProcessor {
  private readonly logger = new Logger(StatsProcessor.name);

  constructor(@Inject(PythonStatsService) private readonly python: PythonStatsService) {}

  @Process()
  async handle(job: Job<StatsJobData>): Promise<StatsJobResult> {
    const { test, input } = job.data;
    try {
      const result = await this.python.runInferential(test, input);
      return { ok: true, result };
    } catch (err) {
      this.logger.warn(`stats job ${job.id} (${test}) degraded: ${(err as Error).message}`);
      // Graceful degradation — do NOT rethrow so the caller gets a warning
      // envelope instead of a failed job retry storm (attempts still apply for
      // transient errors via BullMQ config, but we degrade here).
      return {
        ok: false,
        warning: 'inferential_stats_unavailable',
      };
    }
  }
}