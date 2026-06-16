// apps/api/src/api/organization/organization.module.ts
import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaOrganizationRepository } from '@/infrastructure/database/repositories/organization.repository';
import { PrismaOrganizationMemberRepository } from '@/infrastructure/database/repositories/organization-member.repository';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrganizationController],
  providers: [
    {
      provide: 'IOrganizationRepository',
      useClass: PrismaOrganizationRepository,
    },
    {
      provide: 'IOrganizationMemberRepository',
      useClass: PrismaOrganizationMemberRepository,
    },
  ],
  exports: [
    'IOrganizationRepository',
    'IOrganizationMemberRepository',
  ],
})
export class OrganizationModule {}