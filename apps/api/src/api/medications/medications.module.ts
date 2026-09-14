// apps/api/src/api/medications/medications.module.ts
import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaMedicationRepository } from '@/infrastructure/database/repositories/medication.repository';
import { PrismaAllergyRepository } from '@/infrastructure/database/repositories/allergy.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MedicationsController],
  providers: [
    {
      provide: 'IMedicationRepository',
      useClass: PrismaMedicationRepository,
    },
    {
      provide: 'IAllergyRepository',
      useClass: PrismaAllergyRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
  ],
  exports: ['IMedicationRepository'],
})
export class MedicationsModule {}