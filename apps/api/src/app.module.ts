import { Module } from '@nestjs/common';
import { AuthModule } from './api/auth/auth.module';
import { OrganizationModule } from './api/organization/organization.module';
import { OrganizationMemberModule } from './api/organization-member/organization-member.module';
import { PatientsModule } from './api/patients/patients.module';
import { ConsultationsModule } from './api/consultations/consultations.module';
import { SurgeriesModule } from './api/surgeries/surgeries.module';
import { HealthModule } from './api/health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationModule,
    OrganizationMemberModule,
    PatientsModule,
    ConsultationsModule,
    SurgeriesModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
