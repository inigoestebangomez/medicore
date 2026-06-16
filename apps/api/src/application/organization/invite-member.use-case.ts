// apps/api/src/application/organization/invite-member.use-case.ts
import { createHash, randomBytes } from 'crypto';
import type { MemberRole } from '@medicore/contracts';
import type { IInvitationRepository } from '@/domain/invitation/invitation.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { IEmailService } from '@/infrastructure/email/email.service.interface';

export interface InviteMemberInput {
  email: string;
  role: MemberRole;
  organizationId: string;
  invitedBy: string;
  organizationName: string;
}

export interface InviteMemberOutput {
  invitationId: string;
  email: string;
  role: MemberRole;
  expiresAt: Date;
}

const INVITATION_TTL_HOURS = 72;

export class InviteMemberUseCase {
  constructor(
    private readonly invitationRepo: IInvitationRepository,
    private readonly orgMemberRepo: IOrganizationMemberRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: InviteMemberInput): Promise<InviteMemberOutput> {
    // Verify the inviting user is a member of the org (security check)
    const inviterMembership = await this.orgMemberRepo.findByOrgAndUser(
      input.organizationId,
      input.invitedBy,
    );
    if (!inviterMembership) {
      throw new Error('INVITER_NOT_MEMBER');
    }

    // Check for existing pending invitation for this email in this org
    const existingInvitation = await this.invitationRepo.findByEmailAndOrg(
      input.email,
      input.organizationId,
    );
    if (existingInvitation && !existingInvitation.isExpired() && !existingInvitation.isUsed()) {
      throw new Error('INVITATION_ALREADY_EXISTS');
    }

    // Generate token and hash
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

    const invitation = await this.invitationRepo.create({
      email: input.email,
      tokenHash,
      role: input.role,
      organizationId: input.organizationId,
      invitedBy: input.invitedBy,
      expiresAt,
    });

    // Send invitation email
    const acceptUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/invitations/accept?token=${token}`;
    await this.emailService.sendInvitation({
      to: input.email,
      organizationName: input.organizationName,
      acceptUrl,
      role: input.role,
    });

    return {
      invitationId: invitation.id,
      email: input.email,
      role: input.role,
      expiresAt,
    };
  }
}