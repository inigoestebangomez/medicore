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

  describe('native demographic mapping', () => {
    it('should map phone columns explicitly while retaining fallback extraction', async () => {
      const sample: FileSample = {
        columns: ['Teléfono', 'Móvil', 'Tlf', 'Phone', 'NHC', 'Nombre', 'Edad'],
        rows: [],
      } as any;
      const result = await analyzer.analyzeStructure(sample);
      expect(result.columnMapping['Teléfono']).toBe('phone');
      expect(result.columnMapping['Móvil']).toBe('phone');
      expect(result.columnMapping['Tlf']).toBe('phone');
      expect(result.columnMapping['Phone']).toBe('phone');
    });
  });

  it('maps hospital stay and surgery duration columns to numeric clinical fields', async () => {
    const result = await analyzer.analyzeStructure({
      columns: ['Tiempo de hospitalización (días)', 'Tiempo quirúrgico (minutos)', 'Duración IQ'],
      rows: [{
        'Tiempo de hospitalización (días)': '3 días',
        'Tiempo quirúrgico (minutos)': '138 min',
        'Duración IQ': 138,
      }],
    });

    expect(result.columnMapping['Tiempo de hospitalización (días)']).toBe('hospitalStayDays');
    expect(result.columnMapping['Tiempo quirúrgico (minutos)']).toBe('surgeryDurationMinutes');
    expect(result.columnMapping['Duración IQ']).toBe('surgeryDurationMinutes');
  });

  it('maps consultation and surgery screen column names to their explicit fields', async () => {
    const result = await analyzer.analyzeStructure({
      columns: [
        'Fecha de consulta', 'Motivo de consulta', 'Enfermedad actual', 'Exploración física', 'Valoración',
        'Códigos diagnósticos', 'Plan', 'Fecha de seguimiento', 'Notas de seguimiento', 'Fecha de cirugía',
        'Clasificación ASA', 'Tipo de anestesia', 'Técnica quirúrgica', 'Hallazgos', 'Complicaciones',
        'Notas postoperatorias', 'Resultado',
      ],
      rows: [],
    });

    expect(result.columnMapping).toEqual({
      'Fecha de consulta': 'consultationDate', 'Motivo de consulta': 'chiefComplaint',
      'Enfermedad actual': 'currentIllness', 'Exploración física': 'physicalExam', Valoración: 'assessment',
      'Códigos diagnósticos': 'diagnosisCodes', Plan: 'plan', 'Fecha de seguimiento': 'followUpDate',
      'Notas de seguimiento': 'followUpNotes', 'Fecha de cirugía': 'surgeryDate', 'Clasificación ASA': 'asa',
      'Tipo de anestesia': 'anesthesiaType', 'Técnica quirúrgica': 'technique', Hallazgos: 'findings',
      Complicaciones: 'complications', 'Notas postoperatorias': 'postOpNotes', Resultado: 'outcome',
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
