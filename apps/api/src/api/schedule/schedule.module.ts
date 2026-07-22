// apps/api/src/api/schedule/schedule.module.ts
import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { AuthModule } from '@/api/auth/auth.module';
import { PrismaDoctorScheduleRepository } from '@/infrastructure/database/repositories/doctor-schedule.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ScheduleController],
  providers: [
    {
      provide: 'IDoctorScheduleRepository',
      useClass: PrismaDoctorScheduleRepository,
    },
  ],
})
export class ScheduleModule {}