// apps/api/src/infrastructure/scripts/flag-existing-false-records.spec.ts
import { describe, it, expect } from '@jest/globals';
import { classifyExistingPatient } from './flag-existing-false-records';

describe('classifyExistingPatient (SDD import-data-quality T-08)', () => {
  it('flags an existing patient whose name is an equipment brand', () => {
    const r = classifyExistingPatient({ id: 'p1', nhc: '1', firstName: 'daVinci', lastName: 'Xi' });
    expect(r.isFalse).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('name'))).toBe(true);
  });

  it('does not flag a legitimate patient name', () => {
    const r = classifyExistingPatient({ id: 'p2', nhc: '2', firstName: 'Juan', lastName: 'Pérez' });
    expect(r.isFalse).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it('flags an admin-note name like "Pendiente Revisión"', () => {
    const r = classifyExistingPatient({ id: 'p3', nhc: '3', firstName: 'Pendiente', lastName: 'Revisión' });
    expect(r.isFalse).toBe(true);
  });
});