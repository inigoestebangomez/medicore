import { ImportedClinicalEventSchema, ImportedEventsPageSchema } from './import.schema';

describe('imported clinical event contracts', () => {
  it('accepts a merged imported block with explicit provenance', () => {
    const result = ImportedClinicalEventSchema.parse({
      id: 'import-batch-1-21', type: 'import', date: '2026-01-02T00:00:00.000Z',
      batchId: 'batch-1', batchName: null, rowIndex: 21, rowIndices: [21, 22],
      rowGranularity: 'merged-block', importedAt: '2026-01-03T00:00:00.000Z',
      sourceFormat: 'xlsx', standardFields: { diagnosis: 'rhinitis' }, customFields: {},
    });
    expect(result.rowIndices).toEqual([21, 22]);
  });

  it('rejects an event that claims to be a native clinical entity', () => {
    expect(() => ImportedClinicalEventSchema.parse({ type: 'consultation' })).toThrow();
  });

  it('validates a paginated response and its opaque cursor', () => {
    const result = ImportedEventsPageSchema.parse({
      version: 'v1', items: [], nextCursor: 'opaque', hasMore: true, truncated: false,
    });
    expect(result.version).toBe('v1');
  });
});
