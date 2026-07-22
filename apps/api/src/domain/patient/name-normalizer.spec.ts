// apps/api/src/domain/patient/name-normalizer.spec.ts
import { describe, it, expect } from '@jest/globals';
import { normalizeName, splitNormalizedName } from './name-normalizer';

describe('NameNormalizer', () => {
  describe('normalizeName — title-case with uppercase particles', () => {
    it('title-cases a full uppercase name and keeps particles capitalized', () => {
      expect(normalizeName('JUAN CARLOS DE LA VEGA')).toBe('Juan Carlos De La Vega');
    });

    it('title-cases a name with an embedded single-token particle', () => {
      expect(normalizeName('MARIA DEL CARMEN')).toBe('Maria Del Carmen');
    });

    it('title-cases a single lowercase token', () => {
      expect(normalizeName('ana')).toBe('Ana');
    });

    it('title-cases a hyphenated surname preserving the hyphen', () => {
      expect(normalizeName('JOSÉ ANTONIO GARCÍA-LÓPEZ')).toBe('José Antonio García-López');
    });

    it('keeps multi-word particle sequences capitalized', () => {
      expect(normalizeName('PEPE DE LOS SANTOS')).toBe('Pepe De Los Santos');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeName('')).toBe('');
    });

    it('returns empty string for null input', () => {
      // @ts-expect-error: intentionally passing null
      expect(normalizeName(null)).toBe('');
    });

    it('trims and collapses internal whitespace', () => {
      expect(normalizeName('  JUAN   CARLOS  ')).toBe('Juan Carlos');
    });
  });

  describe('splitNormalizedName — firstName / lastName split', () => {
    it('splits "Juan Carlos De La Vega" → firstName "Juan Carlos", lastName "De La Vega"', () => {
      expect(splitNormalizedName('Juan Carlos De La Vega')).toEqual({
        firstName: 'Juan Carlos',
        lastName: 'De La Vega',
      });
    });

    it('splits "Maria Del Carmen" → firstName "Maria Del", lastName "Carmen" (last token)', () => {
      expect(splitNormalizedName('Maria Del Carmen')).toEqual({
        firstName: 'Maria Del',
        lastName: 'Carmen',
      });
    });

    it('splits single token "Ana" → firstName "Ana", lastName ""', () => {
      expect(splitNormalizedName('Ana')).toEqual({ firstName: 'Ana', lastName: '' });
    });

    it('splits hyphenated surname "José Antonio García-López" keeping hyphen in lastName', () => {
      expect(splitNormalizedName('José Antonio García-López')).toEqual({
        firstName: 'José Antonio',
        lastName: 'García-López',
      });
    });

    it('splits "Pepe De Los Santos" → firstName "Pepe", lastName "De Los Santos"', () => {
      expect(splitNormalizedName('Pepe De Los Santos')).toEqual({
        firstName: 'Pepe',
        lastName: 'De Los Santos',
      });
    });

    it('returns empty firstName/lastName for empty input', () => {
      expect(splitNormalizedName('')).toEqual({ firstName: '', lastName: '' });
    });
  });
});