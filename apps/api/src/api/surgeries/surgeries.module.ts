// apps/api/src/api/surgeries/surgeries.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SurgeriesController } from './surgeries.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaSurgeryRepository } from '@/infrastructure/database/repositories/surgery.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { ReportProcessor } from '@/infrastructure/queues/report-processor';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({ name: 'generate-report' }),
  ],
  controllers: [SurgeriesController],
  providers: [
    {
      provide: 'ISurgeryRepository',
      useClass: PrismaSurgeryRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
    {
      provide: 'REPORT_QUEUE',
      useFactory: (queue: any) => queue,
      inject: ['BullQueue_generate-report'],
    },
    ReportProcessor,
  ],
})
export class SurgeriesModule {}