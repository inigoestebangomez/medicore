// apps/api/src/application/organization/update-member-role.use-case.spec.ts
import { UpdateMemberRoleUseCase } from './update-member-role.use-case';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import { OrganizationMember } from '@/domain/organization-member/organization-member.entity';
import type { MemberRole } from '@medicore/contracts';

// ── In-memory repository ──

class InMemoryOrgMemberRepository implements IOrganizationMemberRepository {
  private members: OrganizationMember[] = [];
  private nextId = 1;

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
      id: `member-${this.nextId++}`,
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

describe('UpdateMemberRoleUseCase', () => {
  let useCase: UpdateMemberRoleUseCase;
  let orgMemberRepo: InMemoryOrgMemberRepository;

  const orgId = 'org-1';

  beforeEach(() => {
    orgMemberRepo = new InMemoryOrgMemberRepository();
    useCase = new UpdateMemberRoleUseCase(orgMemberRepo);
  });

  describe('OWNER can promote member', () => {
    it('should promote a member to ADMIN', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'member-1',
        role: 'PHYSICIAN' as MemberRole,
        invitedBy: 'owner-1',
      });

      const result = await useCase.execute({
        organizationId: orgId,
        targetMemberId: 'member-1',
        newRole: 'ADMIN' as MemberRole,
        actedByUserId: 'owner-1',
      });

      expect(result.role).toBe('ADMIN');
    });

    it('should promote a VIEWER to PHYSICIAN', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'viewer-1',
        role: 'VIEWER' as MemberRole,
        invitedBy: 'owner-1',
      });

      const result = await useCase.execute({
        organizationId: orgId,
        targetMemberId: 'viewer-1',
        newRole: 'PHYSICIAN' as MemberRole,
        actedByUserId: 'owner-1',
      });

      expect(result.role).toBe('PHYSICIAN');
    });
  });

  describe('OWNER can demote ADMIN', () => {
    it('should demote an ADMIN to VIEWER', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'admin-1',
        role: 'ADMIN' as MemberRole,
        invitedBy: 'owner-1',
      });

      const result = await useCase.execute({
        organizationId: orgId,
        targetMemberId: 'admin-1',
        newRole: 'VIEWER' as MemberRole,
        actedByUserId: 'owner-1',
      });

      expect(result.role).toBe('VIEWER');
    });
  });

  describe('BR-ORG-003: last OWNER cannot be demoted', () => {
    it('should reject demoting the last OWNER in an organization', async () => {
      // Only one OWNER in the org
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'solo-owner',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await expect(
        useCase.execute({
          organizationId: orgId,
          targetMemberId: 'solo-owner',
          newRole: 'ADMIN' as MemberRole,
          actedByUserId: 'solo-owner',
        }),
      ).rejects.toThrow('LAST_OWNER_REMOVAL');
    });

    it('should reject changing the last OWNER to any other role', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'solo-owner',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      const roles: MemberRole[] = ['ADMIN' as MemberRole, 'PHYSICIAN' as MemberRole, 'VIEWER' as MemberRole];
      for (const role of roles) {
        await expect(
          useCase.execute({
            organizationId: orgId,
            targetMemberId: 'solo-owner',
            newRole: role,
            actedByUserId: 'solo-owner',
          }),
        ).rejects.toThrow('LAST_OWNER_REMOVAL');
      }
    });

    it('should allow demoting an OWNER when another OWNER exists', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-2',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      // Demote owner-2 (owner-1 remains)
      const result = await useCase.execute({
        organizationId: orgId,
        targetMemberId: 'owner-2',
        newRole: 'ADMIN' as MemberRole,
        actedByUserId: 'owner-1',
      });

      expect(result.role).toBe('ADMIN');
    });
  });

  describe('member not found', () => {
    it('should fail if the target member is not in the organization', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await expect(
        useCase.execute({
          organizationId: orgId,
          targetMemberId: 'user-not-in-org',
          newRole: 'ADMIN' as MemberRole,
          actedByUserId: 'owner-1',
        }),
      ).rejects.toThrow('MEMBER_NOT_FOUND');
    });

    it('should fail if target member is in a different organization', async () => {
      const otherOrgId = 'org-2';

      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      // The target member is in org-2, not org-1
      await orgMemberRepo.create({
        organizationId: otherOrgId,
        userId: 'other-member',
        role: 'PHYSICIAN' as MemberRole,
        invitedBy: null,
      });

      await expect(
        useCase.execute({
          organizationId: orgId,
          targetMemberId: 'other-member',
          newRole: 'ADMIN' as MemberRole,
          actedByUserId: 'owner-1',
        }),
      ).rejects.toThrow('MEMBER_NOT_FOUND');
    });
  });

  describe('role unchanged', () => {
    it('should allow setting the same role (no-op)', async () => {
      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'owner-1',
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      await orgMemberRepo.create({
        organizationId: orgId,
        userId: 'admin-1',
        role: 'ADMIN' as MemberRole,
        invitedBy: 'owner-1',
      });

      const result = await useCase.execute({
        organizationId: orgId,
        targetMemberId: 'admin-1',
        newRole: 'ADMIN' as MemberRole,
        actedByUserId: 'owner-1',
      });

      expect(result.role).toBe('ADMIN');
    });
  });
});