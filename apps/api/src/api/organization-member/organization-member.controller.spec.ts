// apps/api/src/api/organization-member/organization-member.controller.spec.ts
import { OrganizationMemberController } from './organization-member.controller';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IInvitationRepository } from '@/domain/invitation/invitation.repository.interface';
import type { IEmailService } from '@/infrastructure/email/email.service.interface';
import { OrganizationMember } from '@/domain/organization-member/organization-member.entity';
import { Organization } from '@/domain/organization/organization.entity';
import { Invitation } from '@/domain/invitation/invitation.entity';
import type { MemberRole } from '@medicore/contracts';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// ── Mock implementations ──

class MockOrgMemberRepository implements IOrganizationMemberRepository {
  private members: OrganizationMember[] = [];
  private nextMemberId = 1;

  setMockData(members: OrganizationMember[]): void {
    this.members = members;
  }

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
      id: `member-${this.nextMemberId++}`,
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

class MockOrgRepository implements IOrganizationRepository {
  private orgs: Map<string, Organization> = new Map();

  setMockData(orgs: Organization[]): void {
    orgs.forEach((o) => this.orgs.set(o.id, o));
  }

  async findById(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    for (const o of this.orgs.values()) {
      if (o.slug === slug) return o;
    }
    return null;
  }

  async create(data: { name: string; slug: string; type?: string; logoUrl?: string | null }): Promise<Organization> {
    const org = new Organization({ id: `org-${Date.now()}`, name: data.name, slug: data.slug, type: data.type as any });
    this.orgs.set(org.id, org);
    return org;
  }

  async update(id: string, data: Record<string, any>): Promise<Organization> {
    const org = this.orgs.get(id);
    if (!org) throw new Error('Not found');
    const updated = new Organization({ ...org, ...data, id, updatedAt: new Date() });
    this.orgs.set(id, updated);
    return updated;
  }

  async softDelete(_id: string): Promise<Organization> {
    throw new Error('Not implemented');
  }
}

class MockInvitationRepository implements IInvitationRepository {
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

  async create(data: { email: string; tokenHash: string; role: MemberRole; organizationId: string; invitedBy: string; expiresAt: Date }): Promise<Invitation> {
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

  async delete(_id: string): Promise<void> {
    // no-op
  }

  async findByEmailAndOrg(_email: string, _organizationId: string): Promise<Invitation | null> {
    return null;
  }
}

class MockEmailService implements IEmailService {
  async sendInvitation(_params: { to: string; organizationName: string; acceptUrl: string; role: MemberRole }): Promise<void> {
    // no-op for testing
  }

  async sendWelcome(_params: { to: string; userName: string; organizationName: string }): Promise<void> {
    // no-op for testing
  }
}

describe('OrganizationMemberController', () => {
  let controller: OrganizationMemberController;
  let orgMemberRepo: MockOrgMemberRepository;
  let orgRepo: MockOrgRepository;
  let invitationRepo: MockInvitationRepository;
  let emailService: MockEmailService;

  const orgId = 'org-1';
  const ownerId = 'owner-1';
  const adminId = 'admin-1';
  const viewerId = 'viewer-1';

  beforeEach(() => {
    orgMemberRepo = new MockOrgMemberRepository();
    orgRepo = new MockOrgRepository();
    invitationRepo = new MockInvitationRepository();
    emailService = new MockEmailService();

    controller = new OrganizationMemberController(
      orgMemberRepo as any,
      orgRepo as any,
      invitationRepo as any,
      emailService as any,
    );
  });

  // Helper to seed org and membership
  function seedOrgWithMembers() {
    const org = new Organization({ id: orgId, name: 'Test Org', slug: 'test-org', type: 'SOLO_PRACTICE' as any });
    orgRepo.setMockData([org]);

    const members = [
      new OrganizationMember({ id: 'm-owner', organizationId: orgId, userId: ownerId, role: 'OWNER' as MemberRole }),
      new OrganizationMember({ id: 'm-admin', organizationId: orgId, userId: adminId, role: 'ADMIN' as MemberRole }),
      new OrganizationMember({ id: 'm-viewer', organizationId: orgId, userId: viewerId, role: 'VIEWER' as MemberRole }),
    ];
    orgMemberRepo.setMockData(members);
  }

  describe('POST /organizations/:orgId/members/invite', () => {
    it('should allow OWNER to invite a new member', async () => {
      seedOrgWithMembers();

      const user = { sub: ownerId, email: 'owner@test.com', name: 'Owner', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.inviteMember(orgId, { email: 'newuser@test.com', role: 'PHYSICIAN' }, user as any);

      expect(result.email).toBe('newuser@test.com');
      expect(result.role).toBe('PHYSICIAN');
      expect(result.invitationId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should allow ADMIN to invite a new member', async () => {
      seedOrgWithMembers();

      const user = { sub: adminId, email: 'admin@test.com', name: 'Admin', organizationId: orgId, role: 'ADMIN' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.inviteMember(orgId, { email: 'physician@test.com', role: 'PHYSICIAN' }, user as any);

      expect(result.email).toBe('physician@test.com');
    });

    it('should throw ForbiddenException if VIEWER tries to invite', async () => {
      seedOrgWithMembers();

      const user = { sub: viewerId, email: 'viewer@test.com', name: 'Viewer', organizationId: orgId, role: 'VIEWER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.inviteMember(orgId, { email: 'nope@test.com', role: 'PHYSICIAN' }, user as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user is not a member of the org', async () => {
      seedOrgWithMembers();

      const user = { sub: 'outsider', email: 'out@test.com', name: 'Outsider', organizationId: 'other-org', role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.inviteMember(orgId, { email: 'nope@test.com', role: 'PHYSICIAN' }, user as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /organizations/:orgId/members/:memberId/role', () => {
    it('should allow OWNER to update member role', async () => {
      seedOrgWithMembers();

      const user = { sub: ownerId, email: 'owner@test.com', name: 'Owner', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.updateRole(orgId, viewerId, { role: 'PHYSICIAN' }, user as any);

      expect(result.role).toBe('PHYSICIAN');
    });

    it('should allow ADMIN to update member role', async () => {
      seedOrgWithMembers();

      const user = { sub: adminId, email: 'admin@test.com', name: 'Admin', organizationId: orgId, role: 'ADMIN' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.updateRole(orgId, viewerId, { role: 'PHYSICIAN' }, user as any);

      expect(result.role).toBe('PHYSICIAN');
    });

    it('should throw ForbiddenException if VIEWER tries to update role', async () => {
      seedOrgWithMembers();

      const user = { sub: viewerId, email: 'viewer@test.com', name: 'Viewer', organizationId: orgId, role: 'VIEWER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.updateRole(orgId, adminId, { role: 'VIEWER' }, user as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent demoting the last OWNER (BR-ORG-003)', async () => {
      seedOrgWithMembers();

      // Try to demote the sole OWNER
      const user = { sub: ownerId, email: 'owner@test.com', name: 'Owner', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.updateRole(orgId, ownerId, { role: 'ADMIN' }, user as any),
      ).rejects.toThrow('LAST_OWNER_REMOVAL');
    });
  });

  describe('DELETE /organizations/:orgId/members/:memberId', () => {
    it('should allow OWNER to remove a member', async () => {
      seedOrgWithMembers();

      const user = { sub: ownerId, email: 'owner@test.com', name: 'Owner', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.removeMember(orgId, viewerId, user as any);

      expect(result.message).toBe('Member removed successfully');

      // Verify member was removed
      const remaining = await orgMemberRepo.findByOrgId(orgId);
      expect(remaining.find((m) => m.userId === viewerId)).toBeUndefined();
    });

    it('should prevent removing the last OWNER (BR-ORG-003)', async () => {
      // Only one OWNER in the org, plus an ADMIN who is the actor
      const org = new Organization({ id: orgId, name: 'Test Org', slug: 'test-org', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const soleOwner = new OrganizationMember({ id: 'm-sole', organizationId: orgId, userId: ownerId, role: 'OWNER' as MemberRole });
      const viewer = new OrganizationMember({ id: 'm-viewer', organizationId: orgId, userId: viewerId, role: 'VIEWER' as MemberRole });
      const adminMember = new OrganizationMember({ id: 'm-admin', organizationId: orgId, userId: adminId, role: 'ADMIN' as MemberRole });
      orgMemberRepo.setMockData([soleOwner, viewer, adminMember]);

      // Admin tries to remove the sole OWNER — should be blocked
      const adminUser = { sub: adminId, email: 'admin@test.com', name: 'Admin', organizationId: orgId, role: 'ADMIN' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.removeMember(orgId, ownerId, adminUser as any),
      ).rejects.toThrow('Cannot remove the last owner');
    });

    it('should throw ForbiddenException when VIEWER tries to remove', async () => {
      seedOrgWithMembers();

      const user = { sub: viewerId, email: 'viewer@test.com', name: 'Viewer', organizationId: orgId, role: 'VIEWER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.removeMember(orgId, adminId, user as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when removing yourself', async () => {
      seedOrgWithMembers();

      const user = { sub: ownerId, email: 'owner@test.com', name: 'Owner', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(
        controller.removeMember(orgId, ownerId, user as any),
      ).rejects.toThrow('Cannot remove yourself');
    });
  });

  describe('AuthGuard requirement', () => {
    it('should require AuthGuard (decorated with @UseGuards(AuthGuard))', () => {
      // Verify that the controller class is decorated with UseGuards(AuthGuard)
      // NestJS stores guard metadata under '__guards__' key on the class
      const guards = Reflect.getMetadata('__guards__', OrganizationMemberController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });
  });
});