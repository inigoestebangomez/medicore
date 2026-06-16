// apps/api/src/application/organization/update-member-role.use-case.ts
import type { MemberRole } from '@medicore/contracts';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';

export interface UpdateMemberRoleInput {
  organizationId: string;
  targetMemberId: string;
  newRole: MemberRole;
  actedByUserId: string;
}

export interface UpdateMemberRoleOutput {
  id: string;
  role: MemberRole;
}

export class UpdateMemberRoleUseCase {
  constructor(
    private readonly orgMemberRepo: IOrganizationMemberRepository,
  ) {}

  async execute(input: UpdateMemberRoleInput): Promise<UpdateMemberRoleOutput> {
    // targetMemberId is currently treated as userId for the org+user lookup
    const member = await this.orgMemberRepo.findByOrgAndUser(
      input.organizationId,
      input.targetMemberId,
    );

    if (!member) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    // Enforce BR-ORG-003: last OWNER cannot be degraded
    if (member.role === 'OWNER' && input.newRole !== 'OWNER') {
      const ownerCount = await this.orgMemberRepo.countOwnersInOrg(input.organizationId);
      if (ownerCount <= 1) {
        throw new Error('LAST_OWNER_REMOVAL');
      }
    }

    const updated = await this.orgMemberRepo.updateRole(member.id, input.newRole);
    return {
      id: updated.id,
      role: updated.role,
    };
  }
}