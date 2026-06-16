// apps/api/src/application/organization/accept-invitation.use-case.ts
import { createHash } from 'crypto';
import type { IInvitationRepository } from '@/domain/invitation/invitation.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { MemberRole } from '@medicore/contracts';

export interface AcceptInvitationInput {
  token: string;
  userId: string;
}

export interface AcceptInvitationOutput {
  organizationId: string;
  role: MemberRole;
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitationRepo: IInvitationRepository,
    private readonly orgMemberRepo: IOrganizationMemberRepository,
  ) {}

  async execute(input: AcceptInvitationInput): Promise<AcceptInvitationOutput> {
    // Hash the token to look up the invitation
    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    const invitation = await this.invitationRepo.findByTokenHash(tokenHash);
    if (!invitation) {
      throw new Error('INVITATION_NOT_FOUND');
    }

    if (invitation.isExpired()) {
      throw new Error('INVITATION_EXPIRED');
    }

    if (invitation.isUsed()) {
      throw new Error('INVITATION_ALREADY_USED');
    }

    // Check if user is already a member of this org
    const existingMember = await this.orgMemberRepo.findByOrgAndUser(
      invitation.organizationId,
      input.userId,
    );
    if (existingMember) {
      throw new Error('ALREADY_MEMBER');
    }

    // Create membership
    await this.orgMemberRepo.create({
      organizationId: invitation.organizationId,
      userId: input.userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
    });

    // Mark invitation as used
    await this.invitationRepo.markAsUsed(invitation.id);

    return {
      organizationId: invitation.organizationId,
      role: invitation.role,
    };
  }
}