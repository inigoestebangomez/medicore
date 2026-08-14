// apps/api/src/infrastructure/queues/import-queue.module.ts
// BullMQ module for the import finalize queue. Registered globally so the
// controller can inject IMPORT_QUEUE and the worker picks up jobs.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ImportProcessor, IMPORT_QUEUE_NAME } from './import-processor';
import { FieldCatalogCacheModule } from '@/infrastructure/research/field-catalog-cache.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: IMPORT_QUEUE_NAME,
      redis: { maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
    FieldCatalogCacheModule,
  ],
  providers: [ImportProcessor],
  exports: [BullModule],
})
export class ImportQueueModule {}
