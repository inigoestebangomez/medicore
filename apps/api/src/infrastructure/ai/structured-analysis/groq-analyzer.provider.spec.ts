// apps/api/src/infrastructure/ai/structured-analysis/groq-analyzer.provider.spec.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { FileSample } from '@medicore/contracts';
import { GROQ_SYSTEM_PROMPT, GroqAnalyzer } from './groq-analyzer.provider';

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

  it('describes every native demographic mapping in both prompts', () => {
    const analyzer = new GroqAnalyzer();
    const sample: FileSample = { columns: [], rows: [] };
    const userPrompt = (analyzer as unknown as { buildUserPrompt(value: FileSample): string }).buildUserPrompt(sample);
    const fields = [
      'phone', 'email', 'idDocument', 'idDocType', 'address', 'bloodType',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'notes',
      'consultationDate', 'chiefComplaint', 'currentIllness', 'physicalExam', 'assessment', 'diagnosisCodes', 'plan',
      'followUpDate', 'followUpNotes', 'surgeryDate', 'consultationType', 'surgeryStatus', 'asa', 'anesthesiaType',
      'technique', 'findings', 'complications', 'postOpNotes', 'outcome', 'hospitalStayDays', 'surgeryDurationMinutes',
    ];

    for (const field of fields) {
      expect(GROQ_SYSTEM_PROMPT).toContain(field);
      expect(userPrompt).toContain(field);
    }
    expect(GROQ_SYSTEM_PROMPT).toContain('no se ignoran automáticamente');
    expect(GROQ_SYSTEM_PROMPT).toContain('deben mapearse a "phone" o a "emergencyContactPhone"');
    expect(GROQ_SYSTEM_PROMPT).not.toContain('SIEMPRE se mapean como "ignore"');
  });
});
