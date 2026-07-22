// apps/api/src/api/pharma/pharma.module.ts
import { Module } from '@nestjs/common';
import { PharmaController } from './pharma.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { AuthModule } from '@/api/auth/auth.module';
import { PrismaPharmaRepository } from '@/infrastructure/database/repositories/pharma.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PharmaController],
  providers: [
    {
      provide: 'IPharmaRepository',
      useClass: PrismaPharmaRepository,
    },
  ],
})
export class PharmaModule {}