// apps/api/src/api/shared/guards/ai-usage.guard.spec.ts
// Unit tests for BR-REP-009 enforcement at the guard layer.

import { ExecutionContext } from '@nestjs/common';
import { AiUsageGuard } from './ai-usage.guard';
import { Organization } from '@/domain/organization/organization.entity';
import {
  PlanType,
  SubscriptionStatus,
} from '@/domain/organization/organization.types';
import type { IAiReportUsageRepository } from '@/domain/billing/ai-report-usage.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';

function ctx(organizationId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: organizationId ? { organizationId } : undefined }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

class MockOrgRepo implements Partial<IOrganizationRepository> {
  constructor(private org: Organization | null) {}
  async findById(): Promise<Organization | null> { return this.org; }
}

class StubUsageRepo implements Partial<IAiReportUsageRepository> {
  public tryIncrementMock: (orgId: string, ym: string, limit: number | null) => Promise<{ count: number } | null>;
  public calls: { orgId: string; ym: string; limit: number | null }[] = [];
  async tryIncrement(orgId: string, ym: string, limit: number | null) {
    this.calls.push({ orgId, ym, limit });
    return this.tryIncrementMock(orgId, ym, limit);
  }
  async getCurrent(): Promise<any> { return null; }
}

function makeOrg(plan: PlanType): Organization {
  return new Organization({
    id: 'org-1', name: 'ACME', slug: 'acme',
    plan, subscriptionStatus: SubscriptionStatus.ACTIVE,
  });
}

describe('AiUsageGuard', () => {
  const ORG_ENV = process.env.ENABLE_AI_USAGE_GUARD;

  afterEach(() => {
    if (ORG_ENV === undefined) delete process.env.ENABLE_AI_USAGE_GUARD;
    else process.env.ENABLE_AI_USAGE_GUARD = ORG_ENV;
  });

  it('skips entirely when ENABLE_AI_USAGE_GUARD !== "true"', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'false';
    const orgRepo = new MockOrgRepo(makeOrg(PlanType.FREE));
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn();
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    const result = await guard.canActivate(ctx('org-1'));

    expect(result).toBe(true);
    expect(usageRepo.calls).toHaveLength(0);
    expect((usageRepo.tryIncrementMock as jest.Mock)).not.toHaveBeenCalled();
  });

  it('passes for ENTERPRISE without touching the usage counter', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'true';
    const orgRepo = new MockOrgRepo(makeOrg(PlanType.ENTERPRISE));
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn();
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    const result = await guard.canActivate(ctx('org-1'));

    expect(result).toBe(true);
    expect(usageRepo.calls).toHaveLength(0);
  });

  it('passes for FREE under the limit (tryIncrement returns a count)', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'true';
    const orgRepo = new MockOrgRepo(makeOrg(PlanType.FREE));
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn(async () => ({ count: 5 }));
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    const result = await guard.canActivate(ctx('org-1'));

    expect(result).toBe(true);
    expect(usageRepo.calls).toHaveLength(1);
    expect(usageRepo.calls[0].limit).toBe(20); // FREE limit from PlanConfig
  });

  it('throws HTTP 429 with code AI_USAGE_LIMIT_REACHED when FREE is at the limit', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'true';
    const orgRepo = new MockOrgRepo(makeOrg(PlanType.FREE));
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn(async () => null); // limit reached
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    await expect(guard.canActivate(ctx('org-1'))).rejects.toMatchObject({
      status: 429,
      response: {
        statusCode: 429,
        code: 'AI_USAGE_LIMIT_REACHED',
        plan: PlanType.FREE,
        limit: 20,
      },
    });
    expect(usageRepo.calls).toHaveLength(1);
  });

  it('uses PRO limit (200) for PRO organizations', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'true';
    const orgRepo = new MockOrgRepo(makeOrg(PlanType.PRO));
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn(async () => ({ count: 201 }));
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    await guard.canActivate(ctx('org-1'));

    expect(usageRepo.calls[0].limit).toBe(200);
  });

  it('passes when request has no organizationId (non-org-scoped)', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'true';
    const orgRepo = new MockOrgRepo(makeOrg(PlanType.FREE));
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn();
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    const result = await guard.canActivate(ctx(undefined));

    expect(result).toBe(true);
    expect(usageRepo.calls).toHaveLength(0);
  });

  it('passes when org is not found (defers to other guards)', async () => {
    process.env.ENABLE_AI_USAGE_GUARD = 'true';
    const orgRepo = new MockOrgRepo(null);
    const usageRepo = new StubUsageRepo();
    usageRepo.tryIncrementMock = jest.fn();
    const guard = new AiUsageGuard(orgRepo as any, usageRepo as any);

    const result = await guard.canActivate(ctx('org-1'));

    expect(result).toBe(true);
    expect(usageRepo.calls).toHaveLength(0);
  });
});