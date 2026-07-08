import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './api/auth/auth.module';
import { OrganizationModule } from './api/organization/organization.module';
import { OrganizationMemberModule } from './api/organization-member/organization-member.module';
import { PatientsModule } from './api/patients/patients.module';
import { ConsultationsModule } from './api/consultations/consultations.module';
import { SurgeriesModule } from './api/surgeries/surgeries.module';
import { ImagingStudiesModule } from './api/imaging-studies/imaging-studies.module';
import { MedicationsModule } from './api/medications/medications.module';
import { ScalesModule } from './api/scales/scales.module';
import { HealthModule } from './api/health/health.module';
import { AnalyticsModule } from './api/analytics/analytics.module';
import { ExportModule } from './api/export/export.module';
import { ReportsModule } from './api/reports/reports.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { SubscriptionInterceptor } from './api/shared/interceptors/subscription.interceptor';
import { ResponseWrapperInterceptor } from './api/shared/interceptors/response-wrapper.interceptor';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationModule,
    OrganizationMemberModule,
    PatientsModule,
    ConsultationsModule,
    SurgeriesModule,
    ImagingStudiesModule,
    MedicationsModule,
    ScalesModule,
    HealthModule,
    AnalyticsModule,
    ExportModule,
    ReportsModule,
    AuditModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SubscriptionInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseWrapperInterceptor,
    },
  ],
})
export class AppModule {}
