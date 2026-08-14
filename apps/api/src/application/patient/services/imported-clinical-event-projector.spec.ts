import { ImportedClinicalEventProjector } from './imported-clinical-event-projector';

describe('ImportedClinicalEventProjector', () => {
  const projector = new ImportedClinicalEventProjector();

  it('projects one merged event and keeps surviving values only', () => {
    const result = projector.project({
      'batch-1': {
        _rowIndices: [21, 22], _importedAt: '2026-01-03',
        diagnosis: 'surviving diagnosis', procedure: 'procedure',
        overwritten: 'latest value',
      },
    }, 'xlsx');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rowIndices).toEqual([21, 22]);
    expect(result.items[0].rowGranularity).toBe('merged-block');
    expect(result.items[0].customFields).toEqual({ overwritten: 'latest value' });
  });

  it('projects legacy blocks and skips malformed or metadata-only values', () => {
    const result = projector.project({
      legacy: { diagnosis: 'legacy value' },
      empty: { _rowIndex: 2 },
      malformed: ['not a block'],
      scalar: 'not a block',
    }, 'csv');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rowGranularity).toBe('legacy-block');
    expect(result.items[0].batchId).toBe('legacy');
  });

  it('reports truncation without exposing raw values when budgets are exceeded', () => {
    const result = projector.project({
      batch: { diagnosis: 'a'.repeat(2_001), safe: 'kept' },
    }, 'xlsx');
    expect(result.truncated).toBe(true);
    expect(result.items[0].customFields).not.toHaveProperty('diagnosis');
    expect(result.items[0].customFields).toHaveProperty('safe');
  });
});
