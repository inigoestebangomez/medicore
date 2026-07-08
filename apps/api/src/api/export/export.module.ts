import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { PrismaConsultationRepository } from '@/infrastructure/database/repositories/consultation.repository';
import { PrismaSurgeryRepository } from '@/infrastructure/database/repositories/surgery.repository';
import { PrismaImagingStudyRepository } from '@/infrastructure/database/repositories/imaging-study.repository';
import { PrismaMedicationRepository } from '@/infrastructure/database/repositories/medication.repository';
import { PrismaClinicalScaleRepository } from '@/infrastructure/database/repositories/clinical-scale.repository';
import { AuthModule } from '@/api/auth/auth.module';
import { AuditModule } from '@/infrastructure/audit/audit.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [ExportController],
  providers: [
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
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
      provide: 'IImagingStudyRepository',
      useClass: PrismaImagingStudyRepository,
    },
    {
      provide: 'IMedicationRepository',
      useClass: PrismaMedicationRepository,
    },
    {
      provide: 'IClinicalScaleRepository',
      useClass: PrismaClinicalScaleRepository,
    },
  ],
})
export class ExportModule {}
