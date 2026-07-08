// apps/api/src/api/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaAnalyticsRepository } from '@/infrastructure/database/repositories/analytics.repository';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [
    {
      provide: 'IAnalyticsRepository',
      useClass: PrismaAnalyticsRepository,
    },
  ],
})
export class AnalyticsModule {}
