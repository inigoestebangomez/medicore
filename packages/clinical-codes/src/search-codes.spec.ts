import { describe, it, expect } from 'vitest';
import { searchCodes, validateCode, getByCode, listByChapter, ORL_CODES } from './search-codes';

describe('searchCodes', () => {
  it('returns rhinitis codes for "rinitis"', () => {
    const results = searchCodes('rinitis');
    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.description.toLowerCase()).toContain('rinitis');
    }
    const foundJ30 = results.some((r) => r.code.startsWith('J30'));
    expect(foundJ30).toBe(true);
  });

  it('returns acute sinusitis codes for "J01" (exact + prefix match)', () => {
    const results = searchCodes('J01');
    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.code).toMatch(/^J01/);
    }
    const descriptions = results.map((r) => r.description).join(' ');
    expect(descriptions.toLowerCase()).toContain('sinusitis');
  });

  it('returns empty array for empty string', () => {
    expect(searchCodes('')).toEqual([]);
  });

  it('is case-insensitive: RINITIS matches same as rinitis', () => {
    const upper = searchCodes('RINITIS');
    const lower = searchCodes('rinitis');
    expect(upper).toEqual(lower);
  });
});

describe('validateCode', () => {
  it('returns true for existing code J34.2', () => {
    expect(validateCode('ICD10', 'J34.2')).toBe(true);
  });

  it('returns false for non-existent code Z00.0', () => {
    expect(validateCode('ICD10', 'Z00.0')).toBe(false);
  });
});

describe('getByCode', () => {
  it('returns the entry for existing code J34.2', () => {
    const entry = getByCode('ICD10', 'J34.2');
    expect(entry).toBeDefined();
    expect(entry!.code).toBe('J34.2');
    expect(entry!.description).toBe('Desviación del tabique nasal');
  });

  it('returns undefined for invalid code', () => {
    expect(getByCode('ICD10', 'INVALID')).toBeUndefined();
  });
});

describe('listByChapter', () => {
  it('returns entries from chapter J30-J39', () => {
    const results = listByChapter('J30-J39');
    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.chapter).toBe('J30-J39');
    }
  });

  it('returns empty array for non-existent chapter', () => {
    expect(listByChapter('Z00-Z99')).toEqual([]);
  });
});

describe('barrel exports', () => {
  it('exports ORL_CODES as non-empty array', () => {
    expect(ORL_CODES).toBeInstanceOf(Array);
    expect(ORL_CODES.length).toBeGreaterThan(100);
  });

  it('exports all functions', () => {
    expect(typeof searchCodes).toBe('function');
    expect(typeof validateCode).toBe('function');
    expect(typeof getByCode).toBe('function');
    expect(typeof listByChapter).toBe('function');
  });
});
