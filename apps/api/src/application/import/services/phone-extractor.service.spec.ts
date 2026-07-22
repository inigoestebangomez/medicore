// apps/api/src/application/import/services/phone-extractor.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { PhoneExtractorService } from './phone-extractor.service';

const extractor = new PhoneExtractorService();

describe('PhoneExtractorService', () => {
  describe('extract', () => {
    it('prefers the phone labelled (PACIENT) over a (DONA) phone', () => {
      expect(extractor.extract({ notes: '685454901(PACIENT) | 617736561(DONA)' })).toBe('685454901');
    });

    it('returns the first phone when multiple phones have no role label', () => {
      expect(extractor.extract({ contacto: '666111222 / 666333444' })).toBe('666111222');
    });

    it('keeps the international +34 prefix and strips whitespace', () => {
      expect(extractor.extract({ tel: '+34 612 345 678' })).toBe('+34612345678');
    });

    it('extracts a landline introduced by "Teléfono:"', () => {
      expect(extractor.extract({ info: 'Teléfono: 954112233' })).toBe('954112233');
    });

    it('returns null when the only phone is attached to a non-patient role (DONA)', () => {
      expect(extractor.extract({ notas: '617736561(DONA (MARIOLA)' })).toBeNull();
    });

    it('returns null when the cell is a plain name with no digits', () => {
      expect(extractor.extract({ name: 'Juan' })).toBeNull();
    });

    it('returns null when a cell mentions "teléfono" but has no number', () => {
      expect(extractor.extract({ notas: 'No tengo teléfono' })).toBeNull();
    });
  });
});