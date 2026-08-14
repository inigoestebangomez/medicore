// apps/api/src/application/import/services/import-analyzer.service.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { ImportAnalyzerService } from './import-analyzer.service';
import type { StructuredAnalysisProvider } from '@/infrastructure/ai/structured-analysis/structured-analysis.provider';
import type { ColumnMappingProposal, FileSample } from '@medicore/contracts';

function makeProvider(
  name: 'heuristic' | 'groq' | 'claude',
  confidence: number,
  extra: Partial<ColumnMappingProposal> = {},
): StructuredAnalysisProvider {
  const proposal: ColumnMappingProposal = {
    columnMapping: { x: 'nhc' },
    customFieldNames: {},
    junkRowIndices: [],
    issues: [],
    confidence,
    notes: '',
    provider: name,
    ...extra,
  };
  const fn = jest.fn<(sample: FileSample) => Promise<ColumnMappingProposal>>();
  fn.mockResolvedValue(proposal);
  return {
    name,
    modelName: `${name}-mock`,
    analyzeStructure: fn,
  };
}

function unavailableProvider(name: 'groq' | 'claude'): StructuredAnalysisProvider {
  const fn = jest.fn<(sample: FileSample) => Promise<ColumnMappingProposal>>();
  fn.mockRejectedValue(new Error(`${name} unavailable`));
  return {
    name,
    modelName: `${name}-mock`,
    analyzeStructure: fn,
  };
}

const sample: FileSample = { columns: ['x', 'y'], rows: [{ x: '1', y: '2' }] };

describe('ImportAnalyzerService (chain orchestrator)', () => {
  it('should stop at HeuristicAnalyzer when confidence ≥ 0.7', async () => {
    const heuristic = makeProvider('heuristic', 0.9);
    const groq = makeProvider('groq', 0.8);
    const claude = makeProvider('claude', 0.8);
    const svc = new ImportAnalyzerService(heuristic, groq, claude);

    const result = await svc.analyzeWithFallback(sample);

    expect(result.provider).toBe('heuristic');
    expect(result.metThreshold).toBe(true);
    expect(result.proposal.confidence).toBe(0.9);
    expect((groq.analyzeStructure as jest.Mock)).not.toHaveBeenCalled();
    expect((claude.analyzeStructure as jest.Mock)).not.toHaveBeenCalled();
  });

  it('should fall through to GroqAnalyzer when heuristic confidence < 0.7', async () => {
    const heuristic = makeProvider('heuristic', 0.5);
    const groq = makeProvider('groq', 0.85);
    const claude = makeProvider('claude', 0.8);
    const svc = new ImportAnalyzerService(heuristic, groq, claude);

    const result = await svc.analyzeWithFallback(sample);

    expect(result.provider).toBe('groq');
    expect((groq.analyzeStructure as jest.Mock)).toHaveBeenCalledTimes(1);
    expect(result.metThreshold).toBe(true);
  });

  it('should fall through to Claude when Groq fails or is below threshold', async () => {
    const heuristic = makeProvider('heuristic', 0.4);
    const groq = unavailableProvider('groq');
    const claude = makeProvider('claude', 0.8);
    const svc = new ImportAnalyzerService(heuristic, groq, claude);

    const result = await svc.analyzeWithFallback(sample);

    expect(result.provider).toBe('claude');
    expect((claude.analyzeStructure as jest.Mock)).toHaveBeenCalledTimes(1);
    expect(result.attempted.find((a) => a.provider === 'groq')?.success).toBe(false);
  });

  it('should return heuristic result when all AI providers fail', async () => {
    const heuristic = makeProvider('heuristic', 0.4);
    const groq = unavailableProvider('groq');
    const claude = unavailableProvider('claude');
    const svc = new ImportAnalyzerService(heuristic, groq, claude);

    const result = await svc.analyzeWithFallback(sample);

    expect(result.metThreshold).toBe(false);
    expect(result.provider).toBe('heuristic');
    expect(result.proposal.confidence).toBe(0.4);
  });

  it('should still return a fallback proposal mapping all columns to custom if everyone fails', async () => {
    const fn = jest.fn<(sample: FileSample) => Promise<ColumnMappingProposal>>();
    fn.mockRejectedValue(new Error('boom'));
    const heuristic: StructuredAnalysisProvider = {
      name: 'heuristic',
      modelName: 'h',
      analyzeStructure: fn,
    };
    const groq = unavailableProvider('groq');
    const claude = unavailableProvider('claude');
    const svc = new ImportAnalyzerService(heuristic, groq, claude);

    const result = await svc.analyzeWithFallback(sample);

    expect(result.metThreshold).toBe(false);
    expect(Object.values(result.proposal.columnMapping)).toEqual(['custom', 'custom']);
    expect(result.attempted.length).toBe(3);
  });

  it('validates every provider proposal and does not accept an identity collision', async () => {
    const heuristic = makeProvider('heuristic', 0.95, {
      columnMapping: { Nombre: 'patientName', 'Nº Paciente': 'patientName' },
    });
    const groq = makeProvider('groq', 0.85, {
      columnMapping: { Nombre: 'patientName', 'Nº Paciente': 'nhc' },
    });
    const claude = makeProvider('claude', 0.8);
    const svc = new ImportAnalyzerService(heuristic, groq, claude);

    const result = await svc.analyzeWithFallback(sample);

    expect(result.provider).toBe('groq');
    expect(result.proposal.mappingConflicts).toEqual([]);
    expect((groq.analyzeStructure as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});
