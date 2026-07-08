// apps/api/src/api/consultations/consultations.module.ts
import { Module } from '@nestjs/common';
import { ConsultationsController } from './consultations.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaConsultationRepository } from '@/infrastructure/database/repositories/consultation.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { ReportQueueModule } from '@/infrastructure/queues/report-queue.module';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, ReportQueueModule],
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
  ],
})
export class ConsultationsModule {}
