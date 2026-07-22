// apps/api/src/application/import/services/false-record-detector.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { FalseRecordDetectorService } from './false-record-detector.service';

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
});