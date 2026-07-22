// apps/api/src/api/auth/auth.controller.spec.ts
import { AuthController } from './auth.controller';
import type { IUserRepository } from '@/domain/user/user.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { MemberRole } from '@medicore/contracts';
import { User } from '@/domain/user/user.entity';
import { Organization } from '@/domain/organization/organization.entity';
import { OrganizationMember } from '@/domain/organization-member/organization-member.entity';
import { UnauthorizedException } from '@nestjs/common';

// ── Mock implementations ──

function createMockUser(overrides: Partial<{ id: string; email: string; name: string; oauthProvider: string; oauthSub: string }> = {}): User {
  return new User({
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'test@example.com',
    name: overrides.name ?? 'Test User',
    oauthProvider: overrides.oauthProvider ?? 'google',
    oauthSub: overrides.oauthSub ?? 'google-123',
  });
}

function createMockOrg(overrides: Record<string, any> = {}): Organization {
  return new Organization({
    id: overrides.id ?? 'org-1',
    name: overrides.name ?? 'Test Workspace',
    slug: overrides.slug ?? 'test-workspace',
    type: overrides.type ?? 'SOLO_PRACTICE',
  });
}

function createMockMember(overrides: Record<string, any> = {}): OrganizationMember {
  return new OrganizationMember({
    id: overrides.id ?? 'member-1',
    organizationId: overrides.organizationId ?? 'org-1',
    userId: overrides.userId ?? 'user-1',
    role: overrides.role ?? 'OWNER',
    invitedBy: overrides.invitedBy ?? null,
  });
}

// Mock repositories
class MockUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  setMockData(users: User[]): void {
    users.forEach((u) => this.users.set(u.id, u));
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async findByOAuthSub(oauthSub: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.oauthSub === oauthSub) return u;
    }
    return null;
  }

  async upsert(data: { email: string; name: string; avatarUrl?: string | null; oauthProvider: string; oauthSub: string }): Promise<User> {
    const existing = await this.findByOAuthSub(data.oauthSub) ?? await this.findByEmail(data.email);
    if (existing) {
      return existing;
    }
    const user = createMockUser({ email: data.email, name: data.name, oauthProvider: data.oauthProvider, oauthSub: data.oauthSub });
    this.users.set(user.id, user);
    return user;
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }
}

class MockOrgRepository implements IOrganizationRepository {
  private orgs: Map<string, Organization> = new Map();
  private slugIndex: Map<string, Organization> = new Map();

  setMockData(orgs: Organization[]): void {
    orgs.forEach((o) => {
      this.orgs.set(o.id, o);
      this.slugIndex.set(o.slug, o);
    });
  }

  async findById(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.slugIndex.get(slug) ?? null;
  }

  async findAll(): Promise<Organization[]> {
    return Array.from(this.orgs.values());
  }

  async create(data: { name: string; slug: string; type?: string; logoUrl?: string | null }): Promise<Organization> {
    const org = createMockOrg({ name: data.name, slug: data.slug, type: data.type });
    this.orgs.set(org.id, org);
    this.slugIndex.set(org.slug, org);
    return org;
  }

  async update(_id: string, _data: Record<string, any>): Promise<Organization> {
    throw new Error('Not implemented in mock');
  }

  async softDelete(_id: string): Promise<Organization> {
    throw new Error('Not implemented in mock');
  }

  async updateSubscription(_id: string, _data: any): Promise<Organization> {
    throw new Error('Not implemented in mock');
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
    const member = createMockMember(data);
    this.members.push(member);
    return member;
  }

  async delete(_id: string): Promise<void> {
    // no-op
  }

  async updateRole(_id: string, _role: MemberRole): Promise<OrganizationMember> {
    throw new Error('Not implemented in mock');
  }

  async countOwnersInOrg(organizationId: string): Promise<number> {
    return this.members.filter((m) => m.organizationId === organizationId && m.role === 'OWNER').length;
  }
}

// Mock JwtService
class MockJwtService {
  sign(_payload: Record<string, any>): string {
    return 'mock-jwt-token';
  }
}

describe('AuthController', () => {
  let controller: AuthController;
  let userRepo: MockUserRepository;
  let orgRepo: MockOrgRepository;
  let orgMemberRepo: MockOrgMemberRepository;
  let jwtService: MockJwtService;

  beforeEach(() => {
    userRepo = new MockUserRepository();
    orgRepo = new MockOrgRepository();
    orgMemberRepo = new MockOrgMemberRepository();
    jwtService = new MockJwtService();

    controller = new AuthController(
      jwtService as any,
      userRepo as any,
      orgRepo as any,
      orgMemberRepo as any,
    );
  });

  describe('GET /auth/me', () => {
    it('should return current user when authenticated', () => {
      const user = {
        sub: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-1',
        role: 'OWNER' as MemberRole,
        iat: 1718000000,
        exp: 1718600000,
      };

      const result = controller.me(user as any);

      expect(result.sub).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('OWNER');
      expect(result.organizationId).toBe('org-1');
    });
  });

  describe('POST /auth/sync', () => {
    it('should create user and organization on first OAuth login', async () => {
      const mockRes = {
        cookie: jest.fn().mockReturnThis(),
      };

      const result = await controller.sync(
        {
          oauthProvider: 'google',
          oauthSub: 'google-999',
          email: 'newuser@example.com',
          name: 'New User',
          avatarUrl: undefined,
        },
        mockRes as any,
      );

      // Should have created a user
      expect(result.email).toBe('newuser@example.com');
      expect(result.isNewUser).toBe(true);

      // Should have set the cookie
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'medicore-session',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should return existing user on subsequent logins', async () => {
      // Seed existing user
      const existingUser = createMockUser({
        id: 'existing-1',
        email: 'existing@example.com',
        name: 'Existing User',
        oauthProvider: 'google',
        oauthSub: 'google-existing',
      });
      userRepo.setMockData([existingUser]);

      // Seed membership for existing user
      const member = createMockMember({
        id: 'member-existing',
        organizationId: 'org-1',
        userId: 'existing-1',
        role: 'OWNER',
      });
      orgMemberRepo.setMockData([member]);

      // Seed org
      const org = createMockOrg({ id: 'org-1', name: 'Existing Org', slug: 'existing-org' });
      orgRepo.setMockData([org]);

      const mockRes = {
        cookie: jest.fn().mockReturnThis(),
      };

      const result = await controller.sync(
        {
          oauthProvider: 'google',
          oauthSub: 'google-existing',
          email: 'existing@example.com',
          name: 'Existing User',
          avatarUrl: undefined,
        },
        mockRes as any,
      );

      expect(result.isNewUser).toBe(false);
    });

    it('should throw UnauthorizedException when user has no organization membership', async () => {
      // Create a user but no membership
      const user = createMockUser({
        id: 'no-org-user',
        email: 'noorg@example.com',
        name: 'No Org User',
        oauthSub: 'google-noorg',
      });
      userRepo.setMockData([user]);
      // orgMemberRepo has no memberships for this user

      const mockRes = { cookie: jest.fn().mockReturnThis() };

      await expect(
        controller.sync(
          {
            oauthProvider: 'google',
            oauthSub: 'google-noorg',
            email: 'noorg@example.com',
            name: 'No Org User',
            avatarUrl: undefined,
          },
          mockRes as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('should clear cookie and return success message', () => {
      const mockRes = {
        clearCookie: jest.fn().mockReturnThis(),
      };

      const result = controller.logout(mockRes as any);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('medicore-session');
      expect(result.message).toBe('Logged out successfully');
    });
  });
});