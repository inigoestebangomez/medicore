// apps/api/src/api/scales/scales.module.ts
import { Module } from '@nestjs/common';
import { ScalesController } from './scales.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaClinicalScaleRepository } from '@/infrastructure/database/repositories/clinical-scale.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ScalesController],
  providers: [
    {
      provide: 'IClinicalScaleRepository',
      useClass: PrismaClinicalScaleRepository,
    },
    {
      provide: 'IPatientRepository',
      useClass: PrismaPatientRepository,
    },
  ],
})
export class ScalesModule {}