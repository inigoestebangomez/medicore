// apps/api/src/api/organization/organization.controller.ts
import {
  Controller,
  Get,
  Post,
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
import { SkipSubscriptionCheck } from '@/api/shared/decorators/skip-subscription.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import { UpdateOrganizationSchema, CreateOrganizationSchema } from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationController {
  constructor(
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
    @Inject('IOrganizationMemberRepository') private readonly orgMemberRepo: IOrganizationMemberRepository,
  ) {}

  @Post()
  @SkipSubscriptionCheck()
  @UseGuards(AuthGuard)
  async create(
    @Body(new ZodValidationPipe(CreateOrganizationSchema))
    body: { name: string; type: string; logoUrl?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const slug = this.generateSlug(body.name);
    const uniqueSlug = await this.ensureUniqueSlug(slug);

    const org = await this.orgRepo.create({
      name: body.name,
      slug: uniqueSlug,
      type: body.type,
      logoUrl: body.logoUrl,
    });

    await this.orgMemberRepo.create({
      organizationId: org.id,
      userId: user.sub,
      role: 'OWNER',
      invitedBy: null,
    });

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

  private generateSlug(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let suffix = 1;
    while (await this.orgRepo.findBySlug(slug)) {
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }
    return slug;
  }
}