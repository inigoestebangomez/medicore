// apps/api/src/infrastructure/ai/structured-analysis/heuristic-analyzer.provider.spec.ts
import { describe, it, expect } from '@jest/globals';
import { HeuristicAnalyzer } from './heuristic-analyzer.provider';
import type { FileSample } from '@medicore/contracts';

const analyzer = new HeuristicAnalyzer();

describe('HeuristicAnalyzer', () => {
  it('should map "Nº HISTORIA" → nhc with confidence ≥ 0.7', async () => {
    const sample: FileSample = {
      columns: ['Nº HISTORIA', 'Nombre', 'Edad', 'Sexo'],
      rows: [{ 'Nº HISTORIA': '12345', Nombre: 'X', Edad: 50, Sexo: 'H' }],
    };
    const result = await analyzer.analyzeStructure(sample);
    expect(result.columnMapping['Nº HISTORIA']).toBe('nhc');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should map standard Spanish hospital column names', async () => {
    const sample: FileSample = {
      columns: ['Nº Historia', 'Nombre del Paciente', 'Fecha de Nacimiento', 'Edad', 'Sexo', 'Diagnóstico', 'Fecha IQ'],
      rows: [] as any,
    };
    const result = await analyzer.analyzeStructure(sample);
    expect(result.columnMapping['Nº Historia']).toBe('nhc');
    expect(result.columnMapping['Nombre del Paciente']).toBe('patientName');
    expect(result.columnMapping['Fecha de Nacimiento']).toBe('birthDate');
    expect(result.columnMapping['Edad']).toBe('age');
    expect(result.columnMapping['Sexo']).toBe('sex');
    expect(result.columnMapping['Diagnóstico']).toBe('diagnosis');
    expect(result.columnMapping['Fecha IQ']).toBe('admissionDate');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it.each([
    'NHC',
    'Nº Paciente',
    'N° Paciente',
    'No Paciente',
    'Nº Historia',
    'Nº Historia Clínica',
    'Historia Clínica',
    'ID paciente',
  ])('maps "%s" to nhc before the generic patient rule', async (identifier) => {
    const result = await analyzer.analyzeStructure({
      columns: [identifier, 'Nombre'],
      rows: [{ [identifier]: '123', Nombre: 'Ana García' }],
    });

    expect(result.columnMapping[identifier]).toBe('nhc');
    expect(result.columnMapping.Nombre).toBe('patientName');
  });

  it('keeps the exact Nombre + Nº Paciente proposal collision-free', async () => {
    const result = await analyzer.analyzeStructure({
      columns: ['Nombre', 'Nº Paciente'],
      rows: [{ Nombre: 'Ana García', 'Nº Paciente': '123' }],
    });

    expect(result.columnMapping).toEqual({ Nombre: 'patientName', 'Nº Paciente': 'nhc' });
  });

  describe('BR-IMP-007 — phone column exclusion', () => {
    it('should detect "Teléfono" and exclude it', async () => {
      const sample: FileSample = {
        columns: ['Teléfono', 'Móvil', 'Tlf', 'Phone', 'NHC', 'Nombre', 'Edad'],
        rows: [],
      } as any;
      const result = await analyzer.analyzeStructure(sample);
      expect(result.columnMapping['Teléfono']).toBe('ignore');
      expect(result.columnMapping['Móvil']).toBe('ignore');
      expect(result.columnMapping['Tlf']).toBe('ignore');
      expect(result.columnMapping['Phone']).toBe('ignore');
      // Phone columns are never typed into a clinical field name (BR-IMP-007).
      expect(result.columnMapping['Teléfono']).not.toBe('nhc');
      expect(result.columnMapping['Móvil']).not.toBe('patientName');
    });
  });

  describe('Excel date serial detection', () => {
    it('should detect column of Excel serials (30000-60000) as birthDate', async () => {
      const sample: FileSample = {
        columns: ['Paciente', 'Fecha Desconocida'],
        rows: [
          { Paciente: 'A', 'Fecha Desconocida': 46023 },
          { Paciente: 'B', 'Fecha Desconocida': 45000 },
          { Paciente: 'C', 'Fecha Desconocida': 42000 },
        ],
      };
      const result = await analyzer.analyzeStructure(sample);
      expect(result.columnMapping['Fecha Desconocida']).toBe('birthDate');
    });

    it('should NOT treat very-large numbers (NHC like 1.8E7) as dates', async () => {
      const sample: FileSample = {
        columns: ['Historia'],
        rows: [
          { Historia: 18685362 },
          { Historia: 13046043 },
        ],
      };
      const result = await analyzer.analyzeStructure(sample);
      // matched as nhc by name, not a date
      expect(result.columnMapping['Historia']).toBe('nhc');
    });
  });

  describe('junk row detection', () => {
    it('should flag junk rows (X= notes, means) in the sample', async () => {
      const sample: FileSample = {
        columns: ['NHC', 'Nombre'],
        rows: [
          { NHC: '123456', Nombre: 'Ana' },
          { NHC: '', Nombre: 'X=2,4 — media global' },
          { NHC: '654321', Nombre: 'Iván' },
        ],
      };
      const result = await analyzer.analyzeStructure(sample);
      expect(result.junkRowIndices).toContain(1);
      expect(result.junkRowIndices).not.toContain(0);
    });
  });

  describe('confidence and fallback', () => {
    it('should give low confidence to fully ambiguous columns (falls through to AI)', async () => {
      const sample: FileSample = {
        columns: ['columna1', 'columna2', 'columna3', 'dato'],
        rows: [{ columna1: 'A', columna2: 'B', columna3: 'C', dato: 'D' }],
      };
      const result = await analyzer.analyzeStructure(sample);
      expect(result.confidence).toBeLessThan(0.7);
      expect(Object.values(result.columnMapping)).toEqual(['custom', 'custom', 'custom', 'custom']);
    });
  });
});
