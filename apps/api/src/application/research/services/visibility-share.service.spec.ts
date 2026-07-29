// apps/api/src/application/research/services/visibility-share.service.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { VisibilityShareService } from './visibility-share.service';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ResearchQuery } from '@/domain/research/research-query.entity';
import type { FieldCatalogCachePort } from '../ports/field-catalog-cache.port';
void (null as unknown as FieldCatalogCachePort);

const ORG = '00000000-0000-0000-0000-000000000001';
const OWNER = '00000000-0000-0000-0000-000000000002';
const COLLEAGUE = '00000000-0000-0000-0000-000000000003';
const EXTERNAL = '00000000-0000-0000-0000-000000000004';

function makeRepo(stored: ResearchQuery[]): IResearchQueryRepository {
  const map = new Map(stored.map((q) => [q.id, q]));
  return {
    save: jest.fn(async (q) => q),
    findById: jest.fn(async (id: string) => map.get(id) ?? null),
    findByOrg: jest.fn(async () => ({ items: [], total: 0 })),
    update: jest.fn(async (q) => q),
    updateRunStats: jest.fn(async () => stored[0]),
    shareWith: jest.fn(async (q) => q as any),
    unshareWith: jest.fn(async (q) => q as any),
    softDelete: jest.fn(async () => stored[0]),
    updateSharing: jest.fn(async (id: string, _o: any, sharing: { users: string[]; permission: 'view' | 'edit' }) => {
      const q = map.get(id)!;
      return q.setSharing(sharing.users, sharing.permission);
    }),
    findSharedWithMe: jest.fn(async () => []),
  } as unknown as IResearchQueryRepository;
}

function makeService(stored: ResearchQuery[], intraOrg: Set<string>) {
  const repo = makeRepo(stored);
  const audit = { log: jest.fn(async () => {}) };
  const prisma: any = {
    organizationMember: {
      findMany: jest.fn(async ({ where }: any) =>
        where.userId['in'].filter((id: string) => intraOrg.has(id)).map((userId: string) => ({ userId })),
      ),
    },
  };
  const svc = new VisibilityShareService(repo, prisma, audit as any);
  return { svc, repo, audit };
}

describe('VisibilityShareService', () => {
  it('shares with an intra-org colleague and writes an audit log', async () => {
    const q = ResearchQuery.createPrivate({
      id: '00000000-0000-0000-0000-000000000010', organizationId: ORG, createdBy: OWNER,
      name: 'Q', filters: [], filterLogic: 'AND', displayFields: [], visualizations: [],
    });
    const { svc, audit } = makeService([q], new Set([COLLEAGUE]));
    const res = await svc.share({
      queryId: q.id, organizationId: ORG, ownerUserId: OWNER,
      userIds: [COLLEAGUE], permission: 'view',
    });
    expect(res.shared).toEqual([COLLEAGUE]);
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect((audit.log as any).mock.calls[0][0].action).toBe('research_query_share');
  });

  it('blocks sharing with users outside the organization (spec §7)', async () => {
    const q = ResearchQuery.createPrivate({
      id: '00000000-0000-0000-0000-000000000010', organizationId: ORG, createdBy: OWNER,
      name: 'Q', filters: [], filterLogic: 'AND', displayFields: [], visualizations: [],
    });
    const { svc } = makeService([q], new Set([COLLEAGUE])); // EXTERNAL not intra-org
    await expect(
      svc.share({
        queryId: q.id, organizationId: ORG, ownerUserId: OWNER,
        userIds: [COLLEAGUE, EXTERNAL], permission: 'view',
      }),
    ).rejects.toThrow(/outside the organization/);
  });

  it('rejects sharing by a non-owner', async () => {
    const q = ResearchQuery.createPrivate({
      id: '00000000-0000-0000-0000-000000000010', organizationId: ORG, createdBy: OWNER,
      name: 'Q', filters: [], filterLogic: 'AND', displayFields: [], visualizations: [],
    });
    const { svc } = makeService([q], new Set([COLLEAGUE]));
    await expect(
      svc.share({
        queryId: q.id, organizationId: ORG, ownerUserId: COLLEAGUE,
        userIds: [EXTERNAL], permission: 'view',
      }),
    ).rejects.toThrow(/Only the owner/);
  });

  it('enforces view-only permission on edit attempts', () => {
    const { svc } = makeService([], new Set());
    expect(() => svc.ensureCanEdit(OWNER, COLLEAGUE, 'view')).toThrow(/view-only/);
    expect(() => svc.ensureCanEdit(OWNER, COLLEAGUE, 'edit')).not.toThrow();
    expect(() => svc.ensureCanEdit(OWNER, OWNER, null)).not.toThrow(); // owner
  });

  it('revokes all sharing and audits', async () => {
    const q = ResearchQuery.createPrivate({
      id: '00000000-0000-0000-0000-000000000010', organizationId: ORG, createdBy: OWNER,
      name: 'Q', filters: [], filterLogic: 'AND', displayFields: [], visualizations: [],
    });
    const { svc, audit } = makeService([q], new Set());
    const res = await svc.revoke({ queryId: q.id, organizationId: ORG, ownerUserId: OWNER });
    expect(res.revoked).toBe(true);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });
});