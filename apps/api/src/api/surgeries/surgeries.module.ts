// apps/api/src/api/surgeries/surgeries.module.ts
import { Module } from '@nestjs/common';
import { SurgeriesController } from './surgeries.controller';
import { OrgSurgeriesController } from './org-surgeries.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaSurgeryRepository } from '@/infrastructure/database/repositories/surgery.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { ReportQueueModule } from '@/infrastructure/queues/report-queue.module';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, ReportQueueModule],
  controllers: [SurgeriesController, OrgSurgeriesController],
  providers: [
    {
      provide: 'ISurgeryRepository',
      useClass: PrismaSurgeryRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
  ],
})
export class SurgeriesModule {}