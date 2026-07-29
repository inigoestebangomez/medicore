// apps/api/src/api/research/sharing.controller.ts
// Query sharing endpoints (spec §7, BR-RES-001).
//   POST   /research/queries/:id/share {users, permission}    share intra-org
//   DELETE /research/queries/:id/share                        revoke all sharing
//   DELETE /research/queries/:id/share/:userId                 revoke one user
//   GET    /research/shared                                     shared-with-me list

import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, Inject, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload, SharePermission } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { VisibilityShareService } from '@/application/research/services/visibility-share.service';

@Controller('research')
@RequireFeature('RESEARCH_V2_SHARING')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class SharingController {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly sharing: VisibilityShareService,
  ) {}

  @Post('queries/:id/share')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async share(
    @Param('id') id: string,
    @Body() body: { userIds: string[]; permission: SharePermission },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.userIds?.length) throw new BadRequestException('userIds is required');
    try {
      const result = await this.sharing.share({
        queryId: id,
        organizationId: user.organizationId,
        ownerUserId: user.sub,
        userIds: body.userIds,
        permission: body.permission ?? 'view',
      });
      return { data: result };
    } catch (err) {
      // visibility errors → 403 (intra-org / external block / ownership)
      throw err instanceof ForbiddenException ? err : err;
    }
  }

  @Delete('queries/:id/share')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async revokeAll(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const result = await this.sharing.revoke({
      queryId: id,
      organizationId: user.organizationId,
      ownerUserId: user.sub,
    });
    return { data: result };
  }

  @Delete('queries/:id/share/:userId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async revokeOne(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const query = await this.queryRepo.findById(id, user.organizationId);
    if (!query) throw new NotFoundException(`Research query not found: ${id}`);
    if (query.createdBy !== user.sub) {
      throw new ForbiddenException('Only the owner can revoke sharing');
    }
    const remaining = query.sharing.users.filter((u) => u !== userId);
    await this.queryRepo.updateSharing(id, user.organizationId, {
      users: remaining,
      permission: query.sharing.permission,
    });
    return { data: { revokedUserId: userId, remaining } };
  }

  @Get('shared')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async sharedWithMe(@CurrentUser() user: JwtPayload) {
    const items = await this.sharing.listSharedWithMe(user.organizationId, user.sub);
    return { data: items };
  }
}