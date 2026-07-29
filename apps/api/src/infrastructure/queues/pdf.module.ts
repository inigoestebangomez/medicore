// apps/api/src/infrastructure/queues/pdf.module.ts
// Wires the `pdf.render` BullMQ queue (design AD-4) + PDF processor + the
// StoragePort (memory default for dev/test; production binds R2StorageService).

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PdfProcessor } from './pdf.processor';
import { MemoryStorageService } from '@/infrastructure/storage/memory-storage';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pdf.render',
      redis: { maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    }),
  ],
  providers: [
    PdfProcessor,
    { provide: 'StoragePort', useClass: MemoryStorageService },
  ],
  exports: ['StoragePort', BullModule],
})
export class PdfQueueModule {}