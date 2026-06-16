// apps/api/src/domain/patient/value-objects/nhc.vo.spec.ts
import { describe, it, expect } from '@jest/globals';
import { NHC } from './nhc.vo';

describe('NHC Value Object', () => {
  describe('generate', () => {
    it('should generate NHC in YYYY-NNNNN format', () => {
      const nhc = NHC.generate(2026, 1);
      expect(nhc.value).toBe('2026-00001');
      expect(nhc.isExternal).toBe(false);
    });

    it('should pad sequence to 5 digits', () => {
      const nhc = NHC.generate(2026, 34);
      expect(nhc.value).toBe('2026-00034');
    });

    it('should handle large sequences', () => {
      const nhc = NHC.generate(2026, 12345);
      expect(nhc.value).toBe('2026-12345');
    });
  });

  describe('parse', () => {
    it('should parse valid internal NHC format', () => {
      const nhc = NHC.parse('2026-00001');
      expect(nhc.value).toBe('2026-00001');
      expect(nhc.isExternal).toBe(false);
    });

    it('should parse valid external NHC format', () => {
      const nhc = NHC.parse('EXT-2024-001');
      expect(nhc.value).toBe('EXT-2024-001');
      expect(nhc.isExternal).toBe(true);
    });

    it('should accept simple alphanumeric external NHCs', () => {
      const nhc = NHC.parse('ABC123');
      expect(nhc.value).toBe('ABC123');
      expect(nhc.isExternal).toBe(true);
    });

    it('should accept numeric-only NHCs as external format', () => {
      // '202600001' is 9 chars, alphanumeric — valid external NHC
      const nhc = NHC.parse('202600001');
      expect(nhc.isExternal).toBe(true);
    });

    it('should accept short-format NHCs as external format', () => {
      // '2026-001' is 8 chars, alphanumeric — valid external NHC
      const nhc = NHC.parse('2026-001');
      expect(nhc.isExternal).toBe(true);
    });

    it('should accept alphanumeric NHCs as external format', () => {
      // '2026-00ABC' matches the external pattern
      const nhc = NHC.parse('2026-00ABC');
      expect(nhc.isExternal).toBe(true);
    });

    it('should throw on invalid format (wrong year format)', () => {
      expect(() => NHC.parse('26-00001')).toThrow();
    });

    it('should throw on empty string', () => {
      expect(() => NHC.parse('')).toThrow();
    });

    it('should throw on too-short external NHC', () => {
      expect(() => NHC.parse('AB')).toThrow();
    });
  });

  describe('isValid', () => {
    it('should return true for valid internal NHC', () => {
      expect(NHC.isValid('2026-00001')).toBe(true);
    });

    it('should return true for valid external NHC', () => {
      expect(NHC.isValid('EXT-2024-001')).toBe(true);
      expect(NHC.isValid('ABC123')).toBe(true);
    });

    it('should return false for invalid NHC', () => {
      expect(NHC.isValid('invalid')).toBe(false);
      expect(NHC.isValid('')).toBe(false);
    });
  });

  describe('year and sequence extraction', () => {
    it('should extract year from internal NHC', () => {
      const nhc = NHC.parse('2026-00034');
      expect(nhc.year).toBe(2026);
    });

    it('should extract sequence from internal NHC', () => {
      const nhc = NHC.parse('2026-00034');
      expect(nhc.sequence).toBe(34);
    });

    it('should throw when extracting year from external NHC', () => {
      const nhc = NHC.parse('EXT-2024-001');
      expect(() => nhc.year).toThrow('Cannot extract year from external NHC');
    });

    it('should throw when extracting sequence from external NHC', () => {
      const nhc = NHC.parse('EXT-2024-001');
      expect(() => nhc.sequence).toThrow('Cannot extract sequence from external NHC');
    });
  });
});