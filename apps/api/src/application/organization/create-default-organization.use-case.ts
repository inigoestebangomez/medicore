// apps/api/src/application/organization/create-default-organization.use-case.ts
import { Organization } from '@/domain/organization/organization.entity';
import { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import { OrganizationType } from '@/domain/organization/organization.types';
import type { MemberRole } from '@medicore/contracts';

/**
 * Transaction runner interface for wrapping operations in a DB transaction.
 * The in-memory implementation is a no-op passthrough (single-threaded, no concurrency risk).
 * The Prisma implementation MUST use `prisma.$transaction()` to ensure atomicity.
 *
 * REQ-AUTH-004: Organization creation must be transactional — if org creation
 * succeeds but membership fails, we must NOT have an orphaned organization.
 */
export interface ITransactionRunner {
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Default passthrough transaction runner for in-memory/test use.
 * No real transaction is needed since operations are synchronous
 * and single-threaded — there is no concurrency risk.
 */
export class PassthroughTransactionRunner implements ITransactionRunner {
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export interface CreateDefaultOrganizationInput {
  userId: string;
  userName: string;
}

export interface CreateDefaultOrganizationOutput {
  organization: Organization;
  isNew: boolean;
}

export class CreateDefaultOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly orgMemberRepo: IOrganizationMemberRepository,
    private readonly transactionRunner: ITransactionRunner = new PassthroughTransactionRunner(),
  ) {}

  async execute(input: CreateDefaultOrganizationInput): Promise<CreateDefaultOrganizationOutput> {
    // Check if user already has a membership (idempotent)
    const existingMemberships = await this.orgMemberRepo.findByUserId(input.userId);
    if (existingMemberships.length > 0) {
      // User already has org(s), return the first one
      const firstMembership = existingMemberships[0];
      const org = await this.orgRepo.findById(firstMembership.organizationId);
      if (org) {
        return { organization: org, isNew: false };
      }
    }

    // Generate a slug from the user name
    const baseSlug = this.generateSlug(input.userName);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // REQ-AUTH-004: Wrap org creation + membership in a transaction.
    // If membership creation fails, the org must be rolled back to avoid orphaned orgs.
    return this.transactionRunner.runInTransaction(async () => {
      // Create organization with SOLO_PRACTICE type
      const organization = await this.orgRepo.create({
        name: `${input.userName} Workspace`,
        slug,
        type: OrganizationType.SOLO_PRACTICE,
      });

      // Create OWNER membership
      await this.orgMemberRepo.create({
        organizationId: organization.id,
        userId: input.userId,
        role: 'OWNER' as MemberRole,
        invitedBy: null,
      });

      return { organization, isNew: true };
    });
  }

  private generateSlug(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let suffix = 1;
    while (await this.orgRepo.findBySlug(slug)) {
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }
    return slug;
  }
}