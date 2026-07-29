// apps/api/src/application/research/services/visibility-share.service.ts
// Query sharing (spec §7, BR-RES-001 private by default).
// Validates that share targets belong to the SAME organization (external block),
// enforces the permission ('view' | 'edit'), writes the structured sharing
// config, keeps v1 sharedWith in sync (AD-2 backward-compat), and writes an
// AuditLog entry on every share/unshare action.

import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import type {
  Sharing,
  SharePermission,
} from '@medicore/contracts';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface ShareCommand {
  queryId: string;
  organizationId: string;
  ownerUserId: string;
  userIds: string[];
  permission: SharePermission;
}

export interface RevokeCommand {
  queryId: string;
  organizationId: string;
  ownerUserId: string;
}

@Injectable()
export class VisibilityShareService {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Share a query with intra-org colleagues (BR-RES-001, spec §7). */
  async share(cmd: ShareCommand): Promise<{ shared: string[]; permission: SharePermission }> {
    const query = await this.queryRepo.findById(cmd.queryId, cmd.organizationId);
    if (!query) throw new ForbiddenException(`Research query not found: ${cmd.queryId}`);

    if (query.createdBy !== cmd.ownerUserId) {
      throw new ForbiddenException('Only the owner can share a query');
    }

    // External block — every target must belong to the same organization
    const intraOrgUserIds = await this.findIntraOrgUserIds(
      cmd.organizationId,
      cmd.userIds,
    );
    if (intraOrgUserIds.size !== new Set(cmd.userIds).size) {
      const external = cmd.userIds.filter((id) => !intraOrgUserIds.has(id));
      throw new ForbiddenException(
        `Cannot share with users outside the organization: ${external.join(', ')}`,
      );
    }

    const updated = query.setSharing(cmd.userIds, cmd.permission);
    await this.queryRepo.updateSharing(cmd.queryId, cmd.organizationId, updated.sharing as Sharing);

    await this.audit.log({
      organizationId: cmd.organizationId,
      userId: cmd.ownerUserId,
      action: 'research_query_share',
      entityType: 'ResearchQuery',
      entityId: cmd.queryId,
      changes: { userIds: cmd.userIds, permission: cmd.permission },
    });

    return { shared: updated.sharing.users, permission: updated.sharing.permission };
  }

  /** Revoke all sharing (return to private). */
  async revoke(cmd: RevokeCommand): Promise<{ revoked: true }> {
    const query = await this.queryRepo.findById(cmd.queryId, cmd.organizationId);
    if (!query) throw new ForbiddenException(`Research query not found: ${cmd.queryId}`);
    if (query.createdBy !== cmd.ownerUserId) {
      throw new ForbiddenException('Only the owner can revoke sharing');
    }

    await this.queryRepo.updateSharing(cmd.queryId, cmd.organizationId, {
      users: [],
      permission: 'view',
    });

    await this.audit.log({
      organizationId: cmd.organizationId,
      userId: cmd.ownerUserId,
      action: 'research_query_revoke_sharing',
      entityType: 'ResearchQuery',
      entityId: cmd.queryId,
      changes: {},
    });

    return { revoked: true };
  }

  /** Enforce view-only permission: reject mutations by view collaborators. */
  ensureCanEdit(
    ownerId: string,
    currentUserId: string,
    permission: SharePermission | null,
  ): void {
    if (ownerId === currentUserId) return; // owner always can edit
    if (permission === 'edit') return;
    throw new ForbiddenException('This query is shared as view-only — editing is not permitted');
  }

  /** List queries shared with the current user (excludes their own). */
  async listSharedWithMe(organizationId: string, userId: string) {
    return this.queryRepo.findSharedWithMe(organizationId, userId);
  }

  private async findIntraOrgUserIds(
    organizationId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, userId: { in: userIds } },
      select: { userId: true },
    });
    return new Set(members.map((m) => m.userId));
  }
}