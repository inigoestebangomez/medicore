// apps/api/src/api/patients/patients.module.ts
import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { PrismaAllergyRepository } from '@/infrastructure/database/repositories/allergy.repository';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PatientsController],
  providers: [
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
    {
      provide: 'IAllergyRepository',
      useClass: PrismaAllergyRepository,
    },
  ],
  exports: ['IPatientRepository', 'IAllergyRepository'],
})
export class PatientsModule {}