// apps/api/src/api/imaging-studies/imaging-studies.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ImagingStudiesController } from './imaging-studies.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaImagingStudyRepository } from '@/infrastructure/database/repositories/imaging-study.repository';
import { PrismaPendingDeletionRepository } from '@/infrastructure/database/repositories/pending-deletion.repository';
import { R2StorageModule } from '@/infrastructure/storage/r2-storage.module';
import { AuthModule } from '@/api/auth/auth.module';
import { DicomMetadataProcessor } from '@/infrastructure/queues/dicom-metadata.processor';
import { PendingDeletionsProcessor } from '@/infrastructure/queues/pending-deletions.processor';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    R2StorageModule,
    BullModule.registerQueue(
      { name: 'imaging', redis: { maxRetriesPerRequest: null } },
      { name: 'pending-deletions', redis: { maxRetriesPerRequest: null } },
    ),
  ],
  controllers: [ImagingStudiesController],
  providers: [
    {
      provide: 'IImagingStudyRepository',
      useClass: PrismaImagingStudyRepository,
    },
    {
      provide: 'IPendingDeletionRepository',
      useClass: PrismaPendingDeletionRepository,
    },
    {
      provide: 'IMAGING_QUEUE',
      useFactory: (queue: any) => queue,
      inject: ['BullQueue_imaging'],
    },
    {
      provide: 'PENDING_DELETIONS_QUEUE',
      useFactory: (queue: any) => queue,
      inject: ['BullQueue_pending-deletions'],
    },
    DicomMetadataProcessor,
    PendingDeletionsProcessor,
  ],
})
export class ImagingStudiesModule {}