// apps/api/src/api/organization/organization.controller.spec.ts
import { OrganizationController } from './organization.controller';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import { Organization } from '@/domain/organization/organization.entity';
import { OrganizationMember } from '@/domain/organization-member/organization-member.entity';
import type { MemberRole } from '@medicore/contracts';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// ── Mock repositories ──

class MockOrgRepository implements IOrganizationRepository {
  private orgs: Map<string, Organization> = new Map();
  private nextId = 1;

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
    const org = new Organization({ id: `org-${this.nextId++}`, name: data.name, slug: data.slug, type: data.type as any });
    this.orgs.set(org.id, org);
    return org;
  }

  async update(id: string, data: Record<string, any>): Promise<Organization> {
    const org = this.orgs.get(id);
    if (!org) throw new Error('Org not found');
    const updated = new Organization({ ...org, ...data, id, updatedAt: new Date() });
    this.orgs.set(id, updated);
    return updated;
  }

  async softDelete(_id: string): Promise<Organization> {
    throw new Error('Not implemented');
  }
}

class MockOrgMemberRepository implements IOrganizationMemberRepository {
  private members: OrganizationMember[] = [];

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
      id: `member-${this.members.length + 1}`,
      organizationId: data.organizationId,
      userId: data.userId,
      role: data.role,
      invitedBy: data.invitedBy ?? null,
    });
    this.members.push(member);
    return member;
  }

  async delete(_id: string): Promise<void> {
    // no-op
  }

  async updateRole(_id: string, _role: MemberRole): Promise<OrganizationMember> {
    throw new Error('Not implemented');
  }

  async countOwnersInOrg(organizationId: string): Promise<number> {
    return this.members.filter((m) => m.organizationId === organizationId && m.role === 'OWNER').length;
  }
}

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let orgRepo: MockOrgRepository;
  let orgMemberRepo: MockOrgMemberRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    orgRepo = new MockOrgRepository();
    orgMemberRepo = new MockOrgMemberRepository();
    controller = new OrganizationController(orgRepo as any, orgMemberRepo as any);
  });

  describe('GET /organizations/:id', () => {
    it('should return organization for a valid member', async () => {
      const org = new Organization({ id: orgId, name: 'Test Org', slug: 'test-org', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const member = new OrganizationMember({ id: 'm-1', organizationId: orgId, userId, role: 'OWNER' as MemberRole });
      orgMemberRepo.setMockData([member]);

      const user = { sub: userId, email: 'test@example.com', name: 'Test', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.getById(orgId, user as any);

      expect(result.id).toBe(orgId);
      expect(result.name).toBe('Test Org');
      expect(result.slug).toBe('test-org');
    });

    it('should throw NotFoundException if user is not a member', async () => {
      const org = new Organization({ id: 'org-other', name: 'Other Org', slug: 'other-org', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const user = { sub: 'user-stranger', email: 'stranger@example.com', name: 'Stranger', organizationId: 'org-other', role: 'VIEWER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(controller.getById('org-other', user as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent org', async () => {
      // Member exists for org that doesn't exist in repo
      const member = new OrganizationMember({ id: 'm-1', organizationId: 'nonexistent', userId, role: 'OWNER' as MemberRole });
      orgMemberRepo.setMockData([member]);

      const user = { sub: userId, email: 'test@example.com', name: 'Test', organizationId: 'nonexistent', role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(controller.getById('nonexistent', user as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /organizations/:id', () => {
    it('should update organization name when called by OWNER', async () => {
      const org = new Organization({ id: orgId, name: 'Old Name', slug: 'old-name', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const member = new OrganizationMember({ id: 'm-1', organizationId: orgId, userId, role: 'OWNER' as MemberRole });
      orgMemberRepo.setMockData([member]);

      const user = { sub: userId, email: 'test@example.com', name: 'Test', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.update(orgId, { name: 'New Name' }, user as any);

      expect(result.name).toBe('New Name');
    });

    it('should update organization name when called by ADMIN', async () => {
      const org = new Organization({ id: orgId, name: 'Old Name', slug: 'old-name', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const member = new OrganizationMember({ id: 'm-1', organizationId: orgId, userId: 'admin-1', role: 'ADMIN' as MemberRole });
      orgMemberRepo.setMockData([member]);

      const user = { sub: 'admin-1', email: 'admin@example.com', name: 'Admin', organizationId: orgId, role: 'ADMIN' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.update(orgId, { name: 'Admin Updated' }, user as any);

      expect(result.name).toBe('Admin Updated');
    });

    it('should throw ForbiddenException when VIEWER tries to update', async () => {
      const org = new Organization({ id: orgId, name: 'Org', slug: 'org', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const member = new OrganizationMember({ id: 'm-1', organizationId: orgId, userId: 'viewer-1', role: 'VIEWER' as MemberRole });
      orgMemberRepo.setMockData([member]);

      const user = { sub: 'viewer-1', email: 'viewer@example.com', name: 'Viewer', organizationId: orgId, role: 'VIEWER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      await expect(controller.update(orgId, { name: 'Hacked' }, user as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /organizations/:id/members', () => {
    it('should list members of the organization', async () => {
      const org = new Organization({ id: orgId, name: 'Test Org', slug: 'test-org', type: 'SOLO_PRACTICE' as any });
      orgRepo.setMockData([org]);

      const members = [
        new OrganizationMember({ id: 'm-1', organizationId: orgId, userId: 'user-1', role: 'OWNER' as MemberRole }),
        new OrganizationMember({ id: 'm-2', organizationId: orgId, userId: 'user-2', role: 'PHYSICIAN' as MemberRole }),
      ];
      orgMemberRepo.setMockData(members);

      const user = { sub: 'user-1', email: 'test@example.com', name: 'Test', organizationId: orgId, role: 'OWNER' as MemberRole, iat: 1718000000, exp: 1718600000 };

      const result = await controller.listMembers(orgId, user as any);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('OWNER');
      expect(result[1].role).toBe('PHYSICIAN');
    });
  });
});