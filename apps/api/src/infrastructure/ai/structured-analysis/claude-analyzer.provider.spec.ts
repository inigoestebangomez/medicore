import { describe, expect, it } from '@jest/globals';
import type { FileSample } from '@medicore/contracts';
import { CLAUDE_SYSTEM_PROMPT, ClaudeStructuredAnalyzer } from './claude-analyzer.provider';

describe('ClaudeStructuredAnalyzer prompts', () => {
  it('describes every native demographic mapping in both prompts', () => {
    const analyzer = new ClaudeStructuredAnalyzer();
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
      expect(CLAUDE_SYSTEM_PROMPT).toContain(field);
      expect(userPrompt).toContain(field);
    }
    expect(CLAUDE_SYSTEM_PROMPT).toContain('no se ignoran automáticamente');
    expect(CLAUDE_SYSTEM_PROMPT).toContain('deben mapearse a "phone" o a "emergencyContactPhone"');
    expect(CLAUDE_SYSTEM_PROMPT).not.toContain('SIEMPRE se mapean como "ignore"');
  });
});
