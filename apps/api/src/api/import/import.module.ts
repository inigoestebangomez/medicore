// apps/api/src/api/import/import.module.ts
// Wires the Import pipeline: controller, use case handlers, services, repos,
// parsed-file cache, AI analyzers, and the BullMQ finalize queue.
//
// Repositories are bound to their interfaces via DI tokens so the handlers
// stay infrastructure-agnostic. The InMemoryParsedFileCache is the default
// (single-instance MVP); swap for a Redis-backed cache in multi-instance
// deployments without touching the handlers.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ImportController } from './import.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { PrismaImportBatchRepository } from '@/infrastructure/database/repositories/import-batch.repository';
import { PrismaOrganizationRepository } from '@/infrastructure/database/repositories/organization.repository';
import { StructuredAnalysisModule } from '@/infrastructure/ai/structured-analysis/structured-analysis.module';
import { ImportAnalyzerService } from '@/application/import/services/import-analyzer.service';
import { FileParserService } from '@/application/import/services/file-parser.service';
import { DataCleanerService } from '@/application/import/services/data-cleaner.service';
import { PatientMatcherService } from '@/application/import/services/patient-matcher.service';
import { ImportReminderService } from '@/application/import/services/import-reminder.service';
import { InMemoryParsedFileCache } from '@/application/import/services/in-memory-parsed-file-cache';
import { PARSED_FILE_CACHE } from '@/application/import/ports/parsed-file-cache.port';
import { ParseFileHandler } from '@/application/import/handlers/parse-file.handler';
import { AnalyzeColumnsHandler } from '@/application/import/handlers/analyze-columns.handler';
import { ConfirmImportHandler } from '@/application/import/handlers/confirm-import.handler';
import { RevertImportHandler } from '@/application/import/handlers/revert-import.handler';
import { GetImportHistoryHandler } from '@/application/import/handlers/get-import-history.handler';
import { ImportProcessor, IMPORT_QUEUE, IMPORT_QUEUE_NAME } from '@/infrastructure/queues/import-processor';
import { ImportReminderJob } from '@/infrastructure/queues/import-reminder.job';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StructuredAnalysisModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: IMPORT_QUEUE_NAME,
      redis: {
        maxRetriesPerRequest: null, // Required for Bull workers; prevents ioredis retry limit
      },
    }),
  ],
  controllers: [ImportController],
  providers: [
    // BullMQ queue alias: the BullModule token is 'BullQueue_<name>'; expose
    // it under the IMPORT_QUEUE token the controller injects (matches the
    // REPORT_QUEUE pattern in report-queue.module.ts).
    {
      provide: IMPORT_QUEUE,
      useFactory: (queue: any) => queue,
      inject: [`BullQueue_${IMPORT_QUEUE_NAME}`],
    },
    // Repositories.
    { provide: 'IPatientRepository', useClass: PrismaPatientRepository },
    { provide: 'IImportBatchRepository', useClass: PrismaImportBatchRepository },
    { provide: 'IOrganizationRepository', useClass: PrismaOrganizationRepository },
    // Pipeline services.
    FileParserService,
    DataCleanerService,
    PatientMatcherService,
    ImportAnalyzerService,
    ImportReminderService,
    { provide: PARSED_FILE_CACHE, useClass: InMemoryParsedFileCache },
    { provide: 'IParsedFileCache', useExisting: PARSED_FILE_CACHE },
    // Use case handlers.
    ParseFileHandler,
    AnalyzeColumnsHandler,
    ConfirmImportHandler,
    RevertImportHandler,
    GetImportHistoryHandler,
    // Background workers / CRON.
    ImportProcessor,
    ImportReminderJob,
  ],
  exports: [],
})
export class ImportModule {}
