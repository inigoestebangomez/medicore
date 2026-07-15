// apps/api/src/domain/import/patient-match.vo.spec.ts
import { describe, it, expect } from '@jest/globals';
import { PatientMatchVO } from './patient-match.vo';

describe('PatientMatchVO (BR-IMP-004 scoring thresholds)', () => {
  it('should auto-match when score >= 90', () => {
    const m = new PatientMatchVO({ rowIndex: 0, candidateId: 'p-1', score: 100, reason: 'nhc exact' });
    expect(m.decision).toBe('auto');
    expect(m.isAutoMatch).toBe(true);
  });

  it('should require physician confirmation for 50-89', () => {
    const m = new PatientMatchVO({ rowIndex: 0, candidateId: 'p-1', score: 70, reason: 'name+age' });
    expect(m.decision).toBe('confirm');
    expect(m.requiresPhysicianConfirmation).toBe(true);
  });

  it('should create a new patient when score < 50', () => {
    const m = new PatientMatchVO({ rowIndex: 0, candidateId: null, score: 30, reason: 'partial name' });
    expect(m.decision).toBe('new');
    expect(m.createsNewPatient).toBe(true);
    expect(m.candidateId).toBeNull();
  });

  it('should clamp scores outside 0..100', () => {
    const high = new PatientMatchVO({ rowIndex: 0, candidateId: 'p', score: 999, reason: '' });
    const low = new PatientMatchVO({ rowIndex: 0, candidateId: null, score: -5, reason: '' });
    expect(high.score).toBe(100);
    expect(low.score).toBe(0);
  });

  it('should treat exact 90 as auto and exact 50 as confirm', () => {
    expect(new PatientMatchVO({ rowIndex: 0, candidateId: 'p', score: 90, reason: '' }).decision).toBe('auto');
    expect(new PatientMatchVO({ rowIndex: 0, candidateId: 'p', score: 50, reason: '' }).decision).toBe('confirm');
    expect(new PatientMatchVO({ rowIndex: 0, candidateId: null, score: 49, reason: '' }).decision).toBe('new');
  });
});