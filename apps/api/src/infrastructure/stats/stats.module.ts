// apps/api/src/infrastructure/stats/stats.module.ts
// Wires the Python stats microservice client + BullMQ `stats` queue + worker.
// Design: stats.process concurrency 4, attempts 2, backoff 5s, timeout 10s.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PythonStatsService } from './python-stats.service';
import { CircuitBreaker } from './circuit-breaker';
import { StatsProcessor } from './stats.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'stats',
      redis: { maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  providers: [PythonStatsService, CircuitBreaker, StatsProcessor],
  exports: [PythonStatsService, CircuitBreaker],
})
export class ResearchStatsModule {}