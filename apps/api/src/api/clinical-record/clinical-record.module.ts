// apps/api/src/api/clinical-record/clinical-record.module.ts
import { Module } from '@nestjs/common';
import { ClinicalRecordController } from './clinical-record.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { AuthModule } from '@/api/auth/auth.module';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { PrismaHistoryRepository } from '@/infrastructure/database/repositories/clinical-record-history.repository';
import { PrismaCurrentIllnessRepository } from '@/infrastructure/database/repositories/clinical-record-illness.repository';
import { PrismaPhysicalExamRepository } from '@/infrastructure/database/repositories/clinical-record-exam.repository';
import { PrismaLabReportRepository } from '@/infrastructure/database/repositories/clinical-record-lab.repository';
import { PrismaDiagnosisRepository } from '@/infrastructure/database/repositories/clinical-record-diagnosis.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClinicalRecordController],
  providers: [
    { provide: 'IPatientRepository', useClass: PrismaPatientRepository },
    { provide: 'IHistoryRepository', useClass: PrismaHistoryRepository },
    { provide: 'ICurrentIllnessRepository', useClass: PrismaCurrentIllnessRepository },
    { provide: 'IPhysicalExamRepository', useClass: PrismaPhysicalExamRepository },
    { provide: 'ILabReportRepository', useClass: PrismaLabReportRepository },
    { provide: 'IDiagnosisRepository', useClass: PrismaDiagnosisRepository },
  ],
  exports: [
    'IHistoryRepository',
    'ICurrentIllnessRepository',
    'IPhysicalExamRepository',
    'ILabReportRepository',
    'IDiagnosisRepository',
  ],
})
export class ClinicalRecordModule {}
