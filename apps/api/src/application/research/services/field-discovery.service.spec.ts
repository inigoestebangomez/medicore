// apps/api/src/application/research/services/field-discovery.service.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { FieldDiscoveryService } from './field-discovery.service';
import type { FieldCatalogCachePort, CachedCatalog } from '../ports/field-catalog-cache.port';

const ORG = '00000000-0000-0000-0000-000000000001';

class FakeCache implements FieldCatalogCachePort {
  store = new Map<string, CachedCatalog>();
  calls = { get: 0, set: 0, invalidate: 0 };
  async get(id: string) {
    this.calls.get++;
    return this.store.get(id) ?? null;
  }
  async set(id: string, c: CachedCatalog) {
    this.calls.set++;
    this.store.set(id, c);
  }
  async invalidate(id: string) {
    this.calls.invalidate++;
    this.store.delete(id);
  }
}

function makeService(opts: {
  counts?: Array<{ field: string; n: bigint }>;
  sample?: Array<{ field: string; value: string }>;
  total?: number;
}) {
  const cache = new FakeCache();
  const prisma: any = {
    $queryRawUnsafe: jest.fn(async (sql: string, ..._params: unknown[]) => {
      if (sql.includes('COUNT(DISTINCT p.id)')) return opts.counts ?? [];
      if (sql.includes('ORDER BY created_at DESC')) return opts.sample ?? [];
      if (sql.includes('COUNT(*)::bigint')) return [{ n: BigInt(opts.total ?? 100) }];
      return [];
    }),
  };
  const svc = new FieldDiscoveryService(prisma as any, cache);
  return { svc, cache, prisma };
}

describe('FieldDiscoveryService', () => {
  it('generates catalog on cache miss and caches it', async () => {
    const { svc, cache, prisma } = makeService({
      counts: [
        { field: 'EVA', n: BigInt(80) },
        { field: 'admissionDate', n: BigInt(60) },
      ],
      sample: [
        { field: 'EVA', value: '8' },
        { field: 'EVA', value: '3' },
        { field: 'admissionDate', value: '2024-01-15' },
      ],
      total: 100,
    });

    const entries = await svc.getCatalog(ORG, '');
    expect(cache.calls.get).toBe(1);
    expect(cache.calls.set).toBe(1);

    const eva = entries.find((e) => e.field === 'EVA');
    expect(eva?.source).toBe('imported');
    expect(eva?.type).toBe('number');
    expect(eva?.nonNullCount).toBe(80);
    expect(eva?.examples).toContain(8);

    // second call — cache hit, no DB calls
    const before = (prisma.$queryRawUnsafe as any).mock.calls.length;
    await svc.getCatalog(ORG, '');
    expect((prisma.$queryRawUnsafe as any).mock.calls.length).toBe(before);
  });

  it('infers dominant type for mixed values', async () => {
    const { svc } = makeService({
      counts: [{ field: 'mixed', n: BigInt(50) }],
      sample: [
        { field: 'mixed', value: '5' },
        { field: 'mixed', value: '8' },
        { field: 'mixed', value: 'TBD' }, // string
      ],
    });
    const entries = await svc.getCatalog(ORG, 'mixed');
    const mixed = entries.find((e) => e.field === 'mixed');
    expect(mixed?.type).toBe('number'); // numbers dominate (2 of 3)
  });

  it('includes standard fields alongside imported ones', async () => {
    const { svc } = makeService({
      counts: [{ field: 'EVA', n: BigInt(10) }],
      sample: [{ field: 'EVA', value: '5' }],
    });
    const entries = await svc.getCatalog(ORG, '');
    const fields = entries.map((e) => e.field);
    expect(fields).toContain('nhc');
    expect(fields).toContain('birthDate');
    expect(fields).toContain('EVA');
  });

  it('filters by query and type', async () => {
    const { svc } = makeService({
      counts: [
        { field: 'EVA', n: BigInt(80) },
        { field: 'age', n: BigInt(90) },
      ],
      sample: [
        { field: 'EVA', value: '8' },
        { field: 'age', value: '42' },
      ],
    });
    const entries = await svc.getCatalog(ORG, 'ev');
    expect(entries.map((e) => e.field)).toEqual(['EVA']);
  });

  it('invalidate() clears the cache', async () => {
    const { svc, cache } = makeService({
      counts: [{ field: 'EVA', n: BigInt(80) }],
      sample: [{ field: 'EVA', value: '8' }],
    });
    await svc.getCatalog(ORG, '');
    expect(cache.store.has(ORG)).toBe(true);
    await svc.invalidate(ORG);
    expect(cache.store.has(ORG)).toBe(false);
    expect(cache.calls.invalidate).toBe(1);
  });

  it('limits examples to 5 distinct values', async () => {
    const { svc } = makeService({
      counts: [{ field: 'EVA', n: BigInt(50) }],
      sample: Array.from({ length: 12 }, (_, i) => ({ field: 'EVA', value: String(i) })),
    });
    const entries = await svc.getCatalog(ORG, 'EVA');
    const eva = entries.find((e) => e.field === 'EVA');
    expect(eva?.examples.length).toBeLessThanOrEqual(5);
  });
});