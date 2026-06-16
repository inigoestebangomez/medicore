// apps/api/src/api/organization/organization.controller.ts
import {
  Controller,
  Get,
  Patch,
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
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import { UpdateOrganizationSchema } from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationController {
  constructor(
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
    @Inject('IOrganizationMemberRepository') private readonly orgMemberRepo: IOrganizationMemberRepository,
  ) {}

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Verify membership
    const membership = await this.orgMemberRepo.findByOrgAndUser(id, user.sub);
    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    const org = await this.orgRepo.findById(id);
    if (!org || org.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      plan: org.plan,
      settings: org.settings,
      logoUrl: org.logoUrl,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrganizationSchema)) body: { name?: string; settings?: Record<string, unknown>; logoUrl?: string | null },
    @CurrentUser() user: JwtPayload,
  ) {
    // Verify membership (OWNER or ADMIN can update)
    const membership = await this.orgMemberRepo.findByOrgAndUser(id, user.sub);
    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can update organization settings');
    }

    const org = await this.orgRepo.update(id, body);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      plan: org.plan,
      settings: org.settings,
      logoUrl: org.logoUrl,
      updatedAt: org.updatedAt,
    };
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Verify membership
    const membership = await this.orgMemberRepo.findByOrgAndUser(id, user.sub);
    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    const members = await this.orgMemberRepo.findByOrgId(id);

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }
}