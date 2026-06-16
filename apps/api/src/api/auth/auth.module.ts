// apps/api/src/api/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@/infrastructure/auth/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaUserRepository } from '@/infrastructure/database/repositories/user.repository';
import { PrismaOrganizationRepository } from '@/infrastructure/database/repositories/organization.repository';
import { PrismaOrganizationMemberRepository } from '@/infrastructure/database/repositories/organization-member.repository';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthGuard,
    {
      provide: 'IUserRepository',
      useClass: PrismaUserRepository,
    },
    {
      provide: 'IOrganizationRepository',
      useClass: PrismaOrganizationRepository,
    },
    {
      provide: 'IOrganizationMemberRepository',
      useClass: PrismaOrganizationMemberRepository,
    },
  ],
  exports: [JwtModule, AuthGuard],
})
export class AuthModule {}