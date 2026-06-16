// apps/api/src/api/consultations/consultations.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConsultationsController } from './consultations.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaConsultationRepository } from '@/infrastructure/database/repositories/consultation.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { ReportProcessor } from '@/infrastructure/queues/report-processor';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({ name: 'generate-report' }),
  ],
  controllers: [ConsultationsController],
  providers: [
    {
      provide: 'IConsultationRepository',
      useClass: PrismaConsultationRepository,
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
export class ConsultationsModule {}
