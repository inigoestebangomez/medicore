// apps/api/src/api/organization-member/organization-member.module.ts
import { Module } from '@nestjs/common';
import { OrganizationMemberController } from './organization-member.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaOrganizationMemberRepository } from '@/infrastructure/database/repositories/organization-member.repository';
import { PrismaOrganizationRepository } from '@/infrastructure/database/repositories/organization.repository';
import { PrismaInvitationRepository } from '@/infrastructure/database/repositories/invitation.repository';
import { ConsoleEmailService } from '@/infrastructure/email/console-email.service';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrganizationMemberController],
  providers: [
    {
      provide: 'IOrganizationMemberRepository',
      useClass: PrismaOrganizationMemberRepository,
    },
    {
      provide: 'IOrganizationRepository',
      useClass: PrismaOrganizationRepository,
    },
    {
      provide: 'IInvitationRepository',
      useClass: PrismaInvitationRepository,
    },
    {
      provide: 'IEmailService',
      useClass: ConsoleEmailService,
    },
  ],
})
export class OrganizationMemberModule {}