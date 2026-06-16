// apps/api/src/application/organization/accept-invitation.use-case.spec.ts
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import type { IInvitationRepository } from '@/domain/invitation/invitation.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import { Invitation } from '@/domain/invitation/invitation.entity';
import { OrganizationMember } from '@/domain/organization-member/organization-member.entity';
import type { MemberRole } from '@medicore/contracts';
import { createHash, randomBytes } from 'crypto';

// ── In-memory repositories ──

class InMemoryInvitationRepository implements IInvitationRepository {
  private invitations: Map<string, Invitation> = new Map();
  private nextId = 1;

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    for (const inv of this.invitations.values()) {
      if (inv.tokenHash === tokenHash) return inv;
    }
    return null;
  }

  async findByOrgId(organizationId: string): Promise<Invitation[]> {
    return [...this.invitations.values()].filter((i) => i.organizationId === organizationId);
  }

  async create(data: {
    email: string;
    tokenHash: string;
    role: MemberRole;
    organizationId: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<Invitation> {
    const invitation = new Invitation({
      id: `inv-${this.nextId++}`,
      email: data.email,
      tokenHash: data.tokenHash,
      role: data.role,
      organizationId: data.organizationId,
      invitedBy: data.invitedBy,
      expiresAt: data.expiresAt,
    });
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async markAsUsed(id: string): Promise<Invitation> {
    const inv = this.invitations.get(id);
    if (!inv) throw new Error('Invitation not found');
    const used = new Invitation({ ...inv, usedAt: new Date() });
    this.invitations.set(id, used);
    return used;
  }

  async delete(id: string): Promise<void> {
    this.invitations.delete(id);
  }

  async findByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    for (const inv of this.invitations.values()) {
      if (inv.email === email && inv.organizationId === organizationId) return inv;
    }
    return null;
  }
}

class InMemoryOrgMemberRepository implements IOrganizationMemberRepository {
  private members: OrganizationMember[] = [];

  async findByUserId(userId: string): Promise<OrganizationMember[]> {
    return this.members.filter((m) => m.userId === userId);
  }

  async findByOrgId(organizationId: string): Promise<OrganizationMember[]> {
    return this.members.filter((m) => m.organizationId === organizationId);
  }

  async findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    return this.members.find((m) => m.organizationId === organizationId && m.userId === userId) ?? null;
  }

  async create(data: { organizationId: string; userId: string; role: MemberRole; invitedBy?: string | null }): Promise<OrganizationMember> {
    const member = new OrganizationMember({
      id: `member-${this.members.length + 1}`,
      organizationId: data.organizationId,
      userId: data.userId,
      role: data.role,
      invitedBy: data.invitedBy ?? null,
    });
    this.members.push(member);
    return member;
  }

  async delete(id: string): Promise<void> {
    this.members = this.members.filter((m) => m.id !== id);
  }

  async updateRole(id: string, role: MemberRole): Promise<OrganizationMember> {
    const idx = this.members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Member not found');
    const updated = new OrganizationMember({ ...this.members[idx], role, updatedAt: new Date() });
    this.members[idx] = updated;
    return updated;
  }

  async countOwnersInOrg(organizationId: string): Promise<number> {
    return this.members.filter((m) => m.organizationId === organizationId && m.role === 'OWNER').length;
  }
}

// Helper to create a valid invitation and return the raw token
async function seedInvitation(
  invRepo: InMemoryInvitationRepository,
  orgId: string,
  role: MemberRole = 'PHYSICIAN',
  expiresInHours = 72,
  email = 'invited@example.com',
  invitedBy = 'user-inviter',
): Promise<{ token: string; invitationId: string; tokenHash: string }> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const invitation = await invRepo.create({
    email,
    tokenHash,
    role,
    organizationId: orgId,
    invitedBy,
    expiresAt,
  });

  return { token, invitationId: invitation.id, tokenHash };
}

describe('AcceptInvitationUseCase', () => {
  let useCase: AcceptInvitationUseCase;
  let invitationRepo: InMemoryInvitationRepository;
  let orgMemberRepo: InMemoryOrgMemberRepository;

  const orgId = 'org-1';

  beforeEach(() => {
    invitationRepo = new InMemoryInvitationRepository();
    orgMemberRepo = new InMemoryOrgMemberRepository();
    useCase = new AcceptInvitationUseCase(invitationRepo, orgMemberRepo);
  });

  describe('accept valid invitation', () => {
    it('should create a membership and mark invitation as used', async () => {
      const { token } = await seedInvitation(invitationRepo, orgId);

      const result = await useCase.execute({
        token,
        userId: 'user-new',
      });

      expect(result.organizationId).toBe(orgId);
      expect(result.role).toBe('PHYSICIAN');

      // Membership should exist
      const membership = await orgMemberRepo.findByOrgAndUser(orgId, 'user-new');
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe('PHYSICIAN');

      // Invitation should be marked as used
      const invitation = await invitationRepo.findByTokenHash(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(invitation).not.toBeNull();
      expect(invitation!.isUsed()).toBe(true);
    });

    it('should assign correct role from invitation', async () => {
      const { token } = await seedInvitation(invitationRepo, orgId, 'ADMIN');

      const result = await useCase.execute({ token, userId: 'user-role-test' });

      expect(result.role).toBe('ADMIN');
      const membership = await orgMemberRepo.findByOrgAndUser(orgId, 'user-role-test');
      expect(membership!.role).toBe('ADMIN');
    });
  });

  describe('expired invitation', () => {
    it('should reject an expired invitation', async () => {
      const { token } = await seedInvitation(invitationRepo, orgId, 'PHYSICIAN', -1); // expired 1 hour ago

      await expect(
        useCase.execute({ token, userId: 'user-expired' }),
      ).rejects.toThrow('INVITATION_EXPIRED');
    });
  });

  describe('invalid token', () => {
    it('should reject a token that does not match any invitation', async () => {
      await expect(
        useCase.execute({ token: 'nonexistent-token-12345', userId: 'user-no-invite' }),
      ).rejects.toThrow('INVITATION_NOT_FOUND');
    });
  });

  describe('already used invitation', () => {
    it('should reject an already-used invitation', async () => {
      const { token } = await seedInvitation(invitationRepo, orgId);

      // First acceptance
      await useCase.execute({ token, userId: 'user-first' });

      // Second acceptance should fail
      await expect(
        useCase.execute({ token, userId: 'user-second' }),
      ).rejects.toThrow('INVITATION_ALREADY_USED');
    });
  });

  describe('already a member', () => {
    it('should reject if the user is already a member of the organization', async () => {
      const { token } = await seedInvitation(invitationRepo, orgId);

      // Pre-seed the user as a member
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'user-existing',
        role: 'PHYSICIAN' as MemberRole,
        invitedBy: null,
      });

      await expect(
        useCase.execute({ token, userId: 'user-existing' }),
      ).rejects.toThrow('ALREADY_MEMBER');
    });
  });
});