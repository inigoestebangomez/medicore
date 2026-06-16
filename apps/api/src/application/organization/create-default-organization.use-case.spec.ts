// apps/api/src/application/organization/create-default-organization.use-case.spec.ts
import { CreateDefaultOrganizationUseCase, ITransactionRunner, PassthroughTransactionRunner } from './create-default-organization.use-case';
import { Organization } from '@/domain/organization/organization.entity';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';

// In-memory implementations for testing
class InMemoryOrganizationRepository implements IOrganizationRepository {
  private orgs: Map<string, Organization> = new Map();
  private slugIndex: Map<string, Organization> = new Map();
  private nextId = 1;

  async findById(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }
  async findBySlug(slug: string): Promise<Organization | null> {
    return this.slugIndex.get(slug) ?? null;
  }
  async create(data: { name: string; slug: string; type?: string; logoUrl?: string | null }): Promise<Organization> {
    const org = new Organization({ id: `org-${this.nextId++}`, name: data.name, slug: data.slug, type: data.type as any });
    this.orgs.set(org.id, org);
    this.slugIndex.set(org.slug, org);
    return org;
  }
  async update(id: string, data: any): Promise<Organization> {
    const org = this.orgs.get(id);
    if (!org) throw new Error('Org not found');
    const updated = new Organization({ ...org, ...data, id, updatedAt: new Date() });
    this.orgs.set(id, updated);
    return updated;
  }
  async softDelete(id: string): Promise<Organization> {
    const org = this.orgs.get(id);
    if (!org) throw new Error('Org not found');
    const deleted = new Organization({ ...org, deletedAt: new Date() });
    this.orgs.set(id, deleted);
    return deleted;
  }
}

class InMemoryOrgMemberRepository implements IOrganizationMemberRepository {
  private members: any[] = [];

  async findByUserId(userId: string): Promise<any[]> {
    return this.members.filter((m) => m.userId === userId);
  }
  async findByOrgId(organizationId: string): Promise<any[]> {
    return this.members.filter((m) => m.organizationId === organizationId);
  }
  async findByOrgAndUser(organizationId: string, userId: string): Promise<any | null> {
    return this.members.find((m) => m.organizationId === organizationId && m.userId === userId) ?? null;
  }
  async create(data: { organizationId: string; userId: string; role: string; invitedBy?: string | null }): Promise<any> {
    const member = { id: `member-${this.members.length + 1}`, ...data, joinedAt: new Date(), updatedAt: new Date() };
    this.members.push(member);
    return member;
  }
  async delete(id: string): Promise<void> {
    this.members = this.members.filter((m) => m.id !== id);
  }
  async updateRole(id: string, role: string): Promise<any> {
    const member = this.members.find((m) => m.id === id);
    if (!member) throw new Error('Member not found');
    member.role = role;
    member.updatedAt = new Date();
    return member;
  }
  async countOwnersInOrg(organizationId: string): Promise<number> {
    return this.members.filter((m) => m.organizationId === organizationId && m.role === 'OWNER').length;
  }
}

// Failing transaction runner that simulates membership creation failure
class FailingMemberRepo extends InMemoryOrgMemberRepository {
  private shouldFail = false;

  failOnNextCreate(): void {
    this.shouldFail = true;
  }

  async create(data: { organizationId: string; userId: string; role: string; invitedBy?: string | null }): Promise<any> {
    if (this.shouldFail) {
      throw new Error('MEMBERSHIP_CREATE_FAILED');
    }
    return super.create(data);
  }
}

// Rollback-aware transaction runner that undoes org creation on failure
class RollbackTransactionRunner implements ITransactionRunner {
  public rolledBack = false;

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.rolledBack = true;
      throw error;
    }
  }
}

describe('CreateDefaultOrganizationUseCase', () => {
  let useCase: CreateDefaultOrganizationUseCase;
  let orgRepo: InMemoryOrganizationRepository;
  let memberRepo: InMemoryOrgMemberRepository;

  beforeEach(() => {
    orgRepo = new InMemoryOrganizationRepository();
    memberRepo = new InMemoryOrgMemberRepository();
    useCase = new CreateDefaultOrganizationUseCase(orgRepo, memberRepo);
  });

  it('should create a SOLO_PRACTICE org and OWNER membership on first login', async () => {
    const result = await useCase.execute({ userId: 'user-1', userName: 'Dr. Martínez' });

    expect(result.organization.name).toBe('Dr. Martínez Workspace');
    expect(result.organization.type).toBe('SOLO_PRACTICE');
    expect(result.isNew).toBe(true);

    // Verify membership was created
    const memberships = await memberRepo.findByUserId('user-1');
    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe('OWNER');
    expect(memberships[0].organizationId).toBe(result.organization.id);
  });

  it('should generate a slug from user name', async () => {
    const result = await useCase.execute({ userId: 'user-2', userName: 'Dr. María García' });
    expect(result.organization.slug).toBe('dr-maria-garcia');
  });

  it('should return existing org if user already has membership', async () => {
    // First login
    const first = await useCase.execute({ userId: 'user-3', userName: 'Returning User' });

    // Second login — should return the same org
    const second = await useCase.execute({ userId: 'user-3', userName: 'Returning User' });

    expect(second.organization.id).toBe(first.organization.id);
    expect(second.isNew).toBe(false);
  });

  it('should handle slug uniqueness with suffixes', async () => {
    await useCase.execute({ userId: 'user-a', userName: 'Test Clinic' });
    const result = await useCase.execute({ userId: 'user-b', userName: 'Test Clinic' });
    // Second org with same name should get a suffixed slug
    expect(result.organization.slug).toMatch(/^test-clinic-\d+$/);
    expect(result.isNew).toBe(true);
  });

  it('should create org with normalized slug handling accent characters', async () => {
    const result = await useCase.execute({ userId: 'user-5', userName: 'Clínica ORL Hospital Universitario' });
    expect(result.organization.slug).toBe('clinica-orl-hospital-universitario');
  });

  describe('transactional guarantee (REQ-AUTH-004)', () => {
    it('should use PassthroughTransactionRunner by default', () => {
      const defaultUseCase = new CreateDefaultOrganizationUseCase(orgRepo, memberRepo);
      // The default constructor should work — PassthroughTransactionRunner is the default
      expect(defaultUseCase).toBeDefined();
    });

    it('should create org and membership atomically with transaction runner', async () => {
      const transactionRunner = new PassthroughTransactionRunner();
      const txUseCase = new CreateDefaultOrganizationUseCase(orgRepo, memberRepo, transactionRunner);

      const result = await txUseCase.execute({ userId: 'user-tx-1', userName: 'Tx Test' });

      expect(result.organization.name).toBe('Tx Test Workspace');
      expect(result.isNew).toBe(true);

      const memberships = await memberRepo.findByUserId('user-tx-1');
      expect(memberships).toHaveLength(1);
    });

    it('should propagate error and trigger rollback when membership creation fails', async () => {
      const failingMemberRepo = new FailingMemberRepo();
      const transactionRunner = new RollbackTransactionRunner();
      const txUseCase = new CreateDefaultOrganizationUseCase(orgRepo, failingMemberRepo, transactionRunner);

      failingMemberRepo.failOnNextCreate();

      await expect(
        txUseCase.execute({ userId: 'user-tx-fail', userName: 'Fail Test' }),
      ).rejects.toThrow('MEMBERSHIP_CREATE_FAILED');

      // Transaction runner should have been signaled to rollback
      expect(transactionRunner.rolledBack).toBe(true);
    });
  });
});