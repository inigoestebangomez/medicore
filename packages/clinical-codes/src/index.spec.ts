import { describe, it, expect } from 'vitest';
import {
  searchCodes,
  validateCode,
  getByCode,
  listByChapter,
  ORL_CODES,
  type CodeEntry,
  type CodeSystem,
  type SearchResult,
} from './index';

describe('@medicore/clinical-codes barrel', () => {
  it('exports searchCodes', () => {
    expect(typeof searchCodes).toBe('function');
  });

  it('exports validateCode', () => {
    expect(typeof validateCode).toBe('function');
  });

  it('exports getByCode', () => {
    expect(typeof getByCode).toBe('function');
  });

  it('exports listByChapter', () => {
    expect(typeof listByChapter).toBe('function');
  });

  it('exports ORL_CODES as non-empty array', () => {
    expect(Array.isArray(ORL_CODES)).toBe(true);
    expect(ORL_CODES.length).toBeGreaterThan(100);
  });

  it('exports types (compile-time check)', () => {
    const entry: CodeEntry = ORL_CODES[0]!;
    expect(entry.code).toBeDefined();
    expect(entry.system).toBeDefined();

    const system: CodeSystem = 'ICD10';
    expect(system).toBe('ICD10');

    const result: SearchResult = { exact: [], prefix: [], contains: [] };
    expect(result.exact).toEqual([]);
  });
});
