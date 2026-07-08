// apps/api/src/infrastructure/queues/report-queue.module.ts
// Shared BullMQ module for the generate-report queue.
// Imported by consultation and surgery modules to avoid duplicate
// queue/handler registration.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportProcessor } from './report-processor';
import { AnthropicModule } from '@/infrastructure/ai/anthropic.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'generate-report' }), AnthropicModule],
  providers: [
    ReportProcessor,
    {
      provide: 'REPORT_QUEUE',
      useFactory: (queue: any) => queue,
      inject: ['BullQueue_generate-report'],
    },
  ],
  exports: ['REPORT_QUEUE'],
})
export class ReportQueueModule {}
