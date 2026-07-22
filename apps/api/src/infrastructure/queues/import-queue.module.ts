// apps/api/src/infrastructure/queues/import-queue.module.ts
// BullMQ module for the import finalize queue. Registered globally so the
// controller can inject IMPORT_QUEUE and the worker picks up jobs.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ImportProcessor, IMPORT_QUEUE_NAME } from './import-processor';

@Module({
  imports: [BullModule.registerQueue({
    name: IMPORT_QUEUE_NAME,
    redis: { maxRetriesPerRequest: null },
  })],
  providers: [ImportProcessor],
  exports: [BullModule],
})
export class ImportQueueModule {}
