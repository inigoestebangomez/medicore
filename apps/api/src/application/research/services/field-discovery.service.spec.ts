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
  batches?: Array<Record<string, unknown>>;
}) {
  const cache = new FakeCache();
  const prisma: any = {
    $queryRawUnsafe: jest.fn(async (sql: string, ..._params: unknown[]) => {
      if (sql.includes('COUNT(DISTINCT p."id")') && sql.includes('jsonb_each(p."importedData")')) {
        return opts.counts ?? [];
      }
      if (sql.includes('ORDER BY "createdAt" DESC') && sql.includes('jsonb_each(p."importedData")')) {
        return opts.sample ?? [];
      }
      if (sql.includes('COUNT(*)::bigint')) return [{ n: BigInt(opts.total ?? 100) }];
      return [];
    }),
  };
  if (opts.batches) {
    prisma.importBatch = {
      findMany: jest.fn(async () => opts.batches),
    };
  }
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

    const rawQueries = (prisma.$queryRawUnsafe as any).mock.calls.map(
      ([sql]: [string]) => sql,
    );
    expect(rawQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('jsonb_each(p."importedData")'),
        expect.stringContaining('jsonb_each_text(batch_val)'),
        expect.stringContaining('jsonb_each(p."importedData")'),
      ]),
    );

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

  it('enriches fields with import metadata without exposing sample rows', async () => {
    const batchId = '00000000-0000-0000-0000-000000000010';
    const { svc, prisma } = makeService({
      counts: [
        { field: 'EVA clínica', n: BigInt(80) },
        { field: 'Edad paciente', n: BigInt(60) },
      ],
      sample: [
        { field: 'EVA clínica', value: '8' },
        { field: 'Edad paciente', value: '42' },
      ],
      total: 100,
      batches: [{
        id: batchId,
        fileName: 'seguimiento.xlsx',
        originalFormat: 'xlsx',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        columnMapping: { 'EVA clínica': 'custom', 'Edad paciente': 'age' },
        customFieldNames: { 'EVA clínica': 'Dolor percibido' },
        sample: { rows: [{ secret: 'must not be returned' }] },
      }],
    });

    const response = await svc.getCatalogResponse(ORG, '');
    const eva = response.entries.find((entry) => entry.field === 'EVA clínica');
    const age = response.entries.find((entry) => entry.field === 'age' && entry.source === 'standard');

    expect(response.totalPatients).toBe(100);
    expect(eva).toMatchObject({
      label: 'Dolor percibido',
      unit: 'puntos',
      originalHeaders: ['EVA clínica'],
      totalCount: 100,
      completenessPercent: 80,
      batches: [{
        id: batchId,
        fileName: 'seguimiento.xlsx',
        originalFormat: 'xlsx',
        importedAt: '2026-08-01T10:00:00.000Z',
      }],
    });
    expect(age).toMatchObject({
      label: 'Edad',
      unit: 'años',
      originalHeaders: ['Edad paciente'],
      batches: [{ id: batchId }],
    });
    expect(JSON.stringify(response)).not.toContain('must not be returned');
    expect(prisma.importBatch.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: ORG, deletedAt: null },
      select: {
        id: true,
        fileName: true,
        originalFormat: true,
        createdAt: true,
        columnMapping: true,
        customFieldNames: true,
      },
    }));
  });
});
