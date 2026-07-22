import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaReportRepository } from '@/infrastructure/database/repositories/report.repository';
import { PrismaConsultationRepository } from '@/infrastructure/database/repositories/consultation.repository';
import { PrismaSurgeryRepository } from '@/infrastructure/database/repositories/surgery.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { PrismaOrganizationRepository } from '@/infrastructure/database/repositories/organization.repository';
import { PrismaAiReportUsageRepository } from '@/infrastructure/database/repositories/ai-report-usage.repository';
import { AiProviderModule } from '@/infrastructure/billing/ai-provider/ai-provider.module';
import { AuditModule } from '@/infrastructure/audit/audit.module';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AiProviderModule.register(), AuditModule, AuthModule],
  controllers: [ReportsController],
  providers: [
    {
      provide: 'IReportRepository',
      useClass: PrismaReportRepository,
    },
    {
      provide: 'IConsultationRepository',
      useClass: PrismaConsultationRepository,
    },
    {
      provide: 'ISurgeryRepository',
      useClass: PrismaSurgeryRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
    // Needed by AiUsageGuard (org plan lookup + usage counter).
    {
      provide: 'IOrganizationRepository',
      useClass: PrismaOrganizationRepository,
    },
    {
      provide: 'IAiReportUsageRepository',
      useClass: PrismaAiReportUsageRepository,
    },
  ],
  exports: ['IReportRepository'],
})
export class ReportsModule {}
