// apps/api/src/application/billing/queries/get-current-usage.use-case.spec.ts
import { GetCurrentUsageUseCase } from './get-current-usage.use-case';
import { Organization } from '@/domain/organization/organization.entity';
import {
  PlanType,
  SubscriptionStatus,
} from '@/domain/organization/organization.types';

const mockOrgRepo = { findById: jest.fn() };
const mockUsageRepo = { getCurrent: jest.fn() };

describe('GetCurrentUsageUseCase', () => {
  let useCase: GetCurrentUsageUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCurrentUsageUseCase(mockOrgRepo as any, mockUsageRepo as any);
  });

  it('returns 0 + FREE limit (20) when no usage row exists for the month', async () => {
    mockOrgRepo.findById.mockResolvedValue(
      new Organization({ id: 'org-1', name: 'ACME', slug: 'acme', plan: PlanType.FREE }),
    );
    mockUsageRepo.getCurrent.mockResolvedValue(null);

    const result = await useCase.execute({ organizationId: 'org-1' });

    expect(result.aiReportsGenerated).toBe(0);
    expect(result.planLimit).toBe(20);
    expect(result.plan).toBe(PlanType.FREE);
    expect(result.yearMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns the stored count and the PRO limit (200)', async () => {
    mockOrgRepo.findById.mockResolvedValue(
      new Organization({ id: 'org-1', name: 'ACME', slug: 'acme', plan: PlanType.PRO }),
    );
    mockUsageRepo.getCurrent.mockResolvedValue({ organizationId: 'org-1', yearMonth: '2026-07', count: 42 });

    const result = await useCase.execute({ organizationId: 'org-1' });

    expect(result.aiReportsGenerated).toBe(42);
    expect(result.planLimit).toBe(200);
    expect(result.plan).toBe(PlanType.PRO);
  });

  it('returns null limit for ENTERPRISE', async () => {
    mockOrgRepo.findById.mockResolvedValue(
      new Organization({ id: 'org-1', name: 'ACME', slug: 'acme', plan: PlanType.ENTERPRISE, subscriptionStatus: SubscriptionStatus.ACTIVE }),
    );
    mockUsageRepo.getCurrent.mockResolvedValue({ organizationId: 'org-1', yearMonth: '2026-07', count: 9999 });

    const result = await useCase.execute({ organizationId: 'org-1' });

    expect(result.planLimit).toBeNull();
    expect(result.aiReportsGenerated).toBe(9999);
  });

  it('defaults to FREE when org is not found', async () => {
    mockOrgRepo.findById.mockResolvedValue(null);
    mockUsageRepo.getCurrent.mockResolvedValue(null);

    const result = await useCase.execute({ organizationId: 'missing' });

    expect(result.plan).toBe(PlanType.FREE);
    expect(result.planLimit).toBe(20);
  });
});