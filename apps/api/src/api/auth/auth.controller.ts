// apps/api/src/api/auth/auth.controller.ts
import {
  Controller,
  Get,
  Post,
  UseGuards,
  Res,
  Body,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import { SwitchOrganizationSchema, AuthProfileSchema } from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { SyncOAuthUserUseCase } from '@/application/auth/sync-oauth-user.use-case';
import { CreateDefaultOrganizationUseCase } from '@/application/organization/create-default-organization.use-case';
import type { IUserRepository } from '@/domain/user/user.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
    @Inject('IOrganizationMemberRepository') private readonly orgMemberRepo: IOrganizationMemberRepository,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }

  @Post('sync')
  @UseGuards(AuthGuard)
  async sync(@Body(new ZodValidationPipe(AuthProfileSchema)) body: any, @Res({ passthrough: true }) res: any) {
    // 1. Sync user from OAuth profile
    const syncUseCase = new SyncOAuthUserUseCase(this.userRepo);
    const { user, isNewUser } = await syncUseCase.execute({
      oauthProvider: body.oauthProvider,
      oauthSub: body.oauthSub,
      email: body.email,
      name: body.name,
      avatarUrl: body.avatarUrl,
    });

    // 2. If new user, create default organization
    // TODO: Inject a PrismaTransactionRunner via DI for real $transaction support.
    // The default PassthroughTransactionRunner is sufficient for unit tests but
    // does not provide rollback guarantees in production.
    if (isNewUser) {
      const createOrgUseCase = new CreateDefaultOrganizationUseCase(this.orgRepo, this.orgMemberRepo);
      await createOrgUseCase.execute({
        userId: user.id,
        userName: user.name,
      });
    }

    // 3. Load user's primary membership for JWT
    const memberships = await this.orgMemberRepo.findByUserId(user.id);
    const primaryMembership = memberships[0];

    if (!primaryMembership) {
      throw new UnauthorizedException('User has no organization membership');
    }

    const org = await this.orgRepo.findById(primaryMembership.organizationId);

    // 4. Issue new JWT with up-to-date claims
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      organizationId: primaryMembership.organizationId,
      role: primaryMembership.role as any,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    const token = this.jwtService.sign(payload);

    // 5. Set cookie
    res.cookie('medicore-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: primaryMembership.organizationId,
      organizationName: org?.name ?? '',
      role: primaryMembership.role,
      isNewUser,
    };
  }

  @Post('switch-organization')
  @UseGuards(AuthGuard)
  async switchOrganization(
    @Body(new ZodValidationPipe(SwitchOrganizationSchema))
    body: { organizationId: string },
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: any,
  ) {
    // 1. Verify user is a member of the target organization
    const membership = await this.orgMemberRepo.findByOrgAndUser(
      body.organizationId,
      user.sub,
    );

    if (!membership) {
      throw new UnauthorizedException('Not a member of this organization');
    }

    // 2. Issue new JWT with updated organizationId and role
    const payload: JwtPayload = {
      sub: user.sub,
      email: user.email,
      name: user.name,
      organizationId: body.organizationId,
      role: membership.role as any,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };

    const token = this.jwtService.sign(payload);

    // 3. Set new cookie
    res.cookie('medicore-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const org = await this.orgRepo.findById(body.organizationId);

    return {
      message: 'Organization switched',
      organizationId: body.organizationId,
      organizationName: org?.name ?? '',
      role: membership.role,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: any): { message: string } {
    res.clearCookie('medicore-session');
    return { message: 'Logged out successfully' };
  }
}