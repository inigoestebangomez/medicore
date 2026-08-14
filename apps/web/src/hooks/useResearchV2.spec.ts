import { describe, expect, it } from 'vitest';
import { normalizeAdHocResult, type AdHocApiResult } from './useResearchV2';

const BASE_RESULT = {
  totalRows: 1,
  stats: [],
  distributions: [],
  displayFields: ['age'],
  appliedFilters: [],
};

describe('normalizeAdHocResult', () => {
  it('normalizes API items into the rows contract', () => {
    const result = normalizeAdHocResult({
      ...BASE_RESULT,
      items: [{ patientId: 'p1', nhc: '001', fields: { age: 42 } }],
    } as AdHocApiResult);

    expect(result.rows).toEqual([{ patientId: 'p1', nhc: '001', fields: { age: 42 } }]);
  });

  it('accepts legacy rows and prefers them when both shapes exist', () => {
    const result = normalizeAdHocResult({
      ...BASE_RESULT,
      rows: [{ patientId: 'p1', nhc: '001', fields: {} }],
      items: [{ patientId: 'p2', nhc: '002', fields: {} }],
    } as AdHocApiResult);

    expect(result.rows[0].patientId).toBe('p1');
  });
});
