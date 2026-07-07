import { Module } from '@nestjs/common';
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
    ImagingStudiesModule,
    MedicationsModule,
    ScalesModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
