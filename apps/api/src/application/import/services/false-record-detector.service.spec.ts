// apps/api/src/application/import/services/false-record-detector.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { FalseRecordDetectorService } from './false-record-detector.service';
import { DataCleanerService } from './data-cleaner.service';

const detector = new FalseRecordDetectorService();

describe('FalseRecordDetectorService', () => {
  describe('detect — name column', () => {
    it('flags an equipment brand string as a false record', () => {
      const r = detector.detect({ '0': 'daVinci Xi., robot' }, new Map([['0', 'name']]));
      expect(r.isFalse).toBe(true);
      expect(r.reasons.some((x) => x.startsWith('name'))).toBe(true);
    });

    it('flags a numeric record-id string as a false record', () => {
      const r = detector.detect({ '0': '2026-00011' }, new Map([['0', 'name']]));
      expect(r.isFalse).toBe(true);
      expect(r.reasons.some((x) => x.startsWith('name'))).toBe(true);
    });

    it('flags an admin/clinical note string as a false record', () => {
      const r = detector.detect({ '0': 'PENDIENTE REVISIÓN' }, new Map([['0', 'name']]));
      expect(r.isFalse).toBe(true);
      expect(r.reasons.some((x) => x.startsWith('name'))).toBe(true);
    });

    it('does not flag a valid single-word person name', () => {
      const r = detector.detect({ '0': 'Juan' }, new Map([['0', 'name']]));
      expect(r.isFalse).toBe(false);
      expect(r.reasons).toHaveLength(0);
    });

    it('does not flag an empty name (empty fields handled elsewhere)', () => {
      const r = detector.detect({ '0': '' }, new Map([['0', 'name']]));
      expect(r.isFalse).toBe(false);
      expect(r.reasons).toHaveLength(0);
    });
  });

  describe('detect — age column', () => {
    it('does not flag a valid numeric age', () => {
      const r = detector.detect({ '0': '50' }, new Map([['0', 'age']]));
      expect(r.isFalse).toBe(false);
      expect(r.reasons).toHaveLength(0);
    });

    it('flags a free-text age value', () => {
      const r = detector.detect({ '0': 'pendiente' }, new Map([['0', 'age']]));
      expect(r.isFalse).toBe(true);
      expect(r.reasons.some((x) => x.startsWith('age'))).toBe(true);
    });
  });

  describe('detect — sex column', () => {
    it('flags a sex value that does not map to a known sex', () => {
      const r = detector.detect({ '0': 'revisar' }, new Map([['0', 'sex']]));
      expect(r.isFalse).toBe(true);
      expect(r.reasons.some((x) => x.startsWith('sex'))).toBe(true);
    });

    it('does not flag a recognized sex code "M"', () => {
      const r = detector.detect({ '0': 'M' }, new Map([['0', 'sex']]));
      expect(r.isFalse).toBe(false);
      expect(r.reasons).toHaveLength(0);
    });
  });

describe('detect — multiple failing columns', () => {
  it('aggregates reasons from name and age columns', () => {
    const r = detector.detect(
      { '0': 'robot', '1': 'pendiente' },
      new Map([['0', 'name'], ['1', 'age']]),
    );
    expect(r.isFalse).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('name'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('age'))).toBe(true);
  });
});

describe('detect — NHC rule (SDD import-data-quality T-10)', () => {
  // The NHC rule is gated behind a flag (default OFF) until it has been
  // validated against a real import batch. These tests pin both modes so the
  // flag flip is a one-line, behavior-confirmed change.
  const activeDetector = new FalseRecordDetectorService(new DataCleanerService(), true);

  it('does NOT flag any NHC while the rule is gated off (test-first mode)', () => {
    const r = detector.detect({ '0': 'PENDIENTE' }, new Map([['0', 'nhc']]));
    expect(r.isFalse).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it('does NOT flag a numeric hospital NHC even when the rule is active', () => {
    const r = activeDetector.detect({ '0': '13046043' }, new Map([['0', 'nhc']]));
    expect(r.isFalse).toBe(false);
  });

  it('does NOT flag a MediCore NHC (leading digit) even when the rule is active', () => {
    const r = activeDetector.detect({ '0': '2026-00012' }, new Map([['0', 'nhc']]));
    expect(r.isFalse).toBe(false);
  });

  it('flags a textual NHC (≥4 letters, no leading digit) when the rule is active', () => {
    const r = activeDetector.detect({ '0': 'PENDIENTE REVISAR' }, new Map([['0', 'nhc']]));
    expect(r.isFalse).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('nhc'))).toBe(true);
  });
});
});