// apps/api/src/api/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { StripeModule } from '@/infrastructure/billing/stripe.module';
import { AuthModule } from '@/api/auth/auth.module';
import { PrismaOrganizationRepository } from '@/infrastructure/database/repositories/organization.repository';
import { PrismaProcessedStripeEventRepository } from '@/infrastructure/database/repositories/processed-stripe-event.repository';
import { PrismaAiReportUsageRepository } from '@/infrastructure/database/repositories/ai-report-usage.repository';

@Module({
  imports: [PrismaModule, StripeModule, AuthModule],
  controllers: [BillingController],
  providers: [
    {
      provide: 'IOrganizationRepository',
      useClass: PrismaOrganizationRepository,
    },
    {
      provide: 'IProcessedStripeEventRepository',
      useClass: PrismaProcessedStripeEventRepository,
    },
    {
      provide: 'IAiReportUsageRepository',
      useClass: PrismaAiReportUsageRepository,
    },
  ],
})
export class BillingModule {}