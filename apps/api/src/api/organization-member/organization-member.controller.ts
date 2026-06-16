// apps/api/src/api/organization-member/organization-member.controller.ts
import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IInvitationRepository } from '@/domain/invitation/invitation.repository.interface';
import type { IEmailService } from '@/infrastructure/email/email.service.interface';
import { InviteMemberSchema, UpdateMemberRoleSchema, AcceptInvitationSchema } from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { InviteMemberUseCase } from '@/application/organization/invite-member.use-case';
import { AcceptInvitationUseCase } from '@/application/organization/accept-invitation.use-case';
import { UpdateMemberRoleUseCase } from '@/application/organization/update-member-role.use-case';

@Controller('organizations/:orgId/members')
@UseGuards(AuthGuard)
export class OrganizationMemberController {
  constructor(
    @Inject('IOrganizationMemberRepository') private readonly orgMemberRepo: IOrganizationMemberRepository,
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
    @Inject('IInvitationRepository') private readonly invitationRepo: IInvitationRepository,
    @Inject('IEmailService') private readonly emailService: IEmailService,
  ) {}

  @Post('invite')
  async inviteMember(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(InviteMemberSchema)) body: { email: string; role: string },
    @CurrentUser() user: JwtPayload,
  ) {
    // Verify the inviter is a member with permission to invite
    const membership = await this.orgMemberRepo.findByOrgAndUser(orgId, user.sub);
    if (!membership) {
      throw new NotFoundException('Organization not found');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const useCase = new InviteMemberUseCase(
      this.invitationRepo,
      this.orgMemberRepo,
      this.emailService,
    );

    const result = await useCase.execute({
      email: body.email,
      role: body.role as any,
      organizationId: orgId,
      invitedBy: user.sub,
      organizationName: org.name,
    });

    return {
      invitationId: result.invitationId,
      email: result.email,
      role: result.role,
      expiresAt: result.expiresAt,
    };
  }

  @Post('accept')
  async acceptInvitation(
    @Param('orgId') _orgId: string,
    @Body(new ZodValidationPipe(AcceptInvitationSchema)) body: { token: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const useCase = new AcceptInvitationUseCase(
      this.invitationRepo,
      this.orgMemberRepo,
    );

    const result = await useCase.execute({
      token: body.token,
      userId: user.sub,
    });

    return {
      organizationId: result.organizationId,
      role: result.role,
    };
  }

  @Patch(':memberId/role')
  async updateRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleSchema)) body: { role: string },
    @CurrentUser() user: JwtPayload,
  ) {
    // Verify the actor is an OWNER or ADMIN
    const actorMembership = await this.orgMemberRepo.findByOrgAndUser(orgId, user.sub);
    if (!actorMembership) {
      throw new NotFoundException('Organization not found');
    }
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can update member roles');
    }

    const useCase = new UpdateMemberRoleUseCase(this.orgMemberRepo);

    const result = await useCase.execute({
      organizationId: orgId,
      targetMemberId: memberId,
      newRole: body.role as any,
      actedByUserId: user.sub,
    });

    return {
      id: result.id,
      role: result.role,
    };
  }

  @Delete(':memberId')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Verify the actor is an OWNER or ADMIN
    const actorMembership = await this.orgMemberRepo.findByOrgAndUser(orgId, user.sub);
    if (!actorMembership) {
      throw new NotFoundException('Organization not found');
    }
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can remove members');
    }

    // Cannot remove self — must use leave-organization flow
    if (memberId === user.sub) {
      throw new ForbiddenException('Cannot remove yourself. Use organization leave instead.');
    }

    // BR-ORG-003: Cannot remove the last OWNER of the organization
    const targetMember = await this.orgMemberRepo.findByOrgAndUser(orgId, memberId);
    if (targetMember && targetMember.role === 'OWNER') {
      const ownerCount = await this.orgMemberRepo.countOwnersInOrg(orgId);
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot remove the last owner of the organization. Transfer ownership first.');
      }
    }

    await this.orgMemberRepo.delete(targetMember ? targetMember.id : memberId);
    return { message: 'Member removed successfully' };
  }
}