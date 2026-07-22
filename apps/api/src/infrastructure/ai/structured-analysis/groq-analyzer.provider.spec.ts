// apps/api/src/infrastructure/ai/structured-analysis/groq-analyzer.provider.spec.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GroqAnalyzer } from './groq-analyzer.provider';

describe('GroqAnalyzer availability (no network)', () => {
  const original = process.env.GROQ_API_KEY;

  beforeEach(() => { delete process.env.GROQ_API_KEY; });
  afterEach(() => {
    if (original === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = original;
  });

  it('should report unavailable when GROQ_API_KEY is unset', () => {
    const analyzer = new GroqAnalyzer();
    expect(analyzer.isAvailable()).toBe(false);
  });

  it('should report available when GROQ_API_KEY is set', () => {
    process.env.GROQ_API_KEY = 'test-key';
    const analyzer = new GroqAnalyzer();
    expect(analyzer.isAvailable()).toBe(true);
    expect(analyzer.name).toBe('groq');
  });

  it('should throw on analyzeStructure when no key (caller falls through)', async () => {
    const analyzer = new GroqAnalyzer();
    await expect(analyzer.analyzeStructure({ columns: ['x'], rows: [] })).rejects.toThrow(/GROQ_API_KEY/);
  });
});