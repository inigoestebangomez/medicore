// apps/api/src/infrastructure/ai/structured-analysis/claude-analyzer.provider.ts
// Claude Sonnet structured analyzer — paid fallback when Groq is unavailable
// or still below the 0.7 confidence threshold (AD-2). Uses the Anthropic SDK
// (already a dependency) with temperature 0 and a strict "JSON only" prompt.
// If ANTHROPIC_API_KEY is unset or the request fails, `analyzeStructure`
// throws and the orchestrator's caller decides how to degrade (the heuristic
// result is always returned as a last-resort fallback).

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  ColumnMappingProposalSchema,
  type ColumnMappingProposal,
  type FileSample,
} from '@medicore/contracts';
import type { StructuredAnalysisProvider } from './structured-analysis.provider';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export const CLAUDE_SYSTEM_PROMPT = `Eres un asistente especializado en analizar bases de datos médicas de hospitales españoles.
Recibirás las columnas y las primeras filas de un archivo Excel de un médico y debes:
1. Identificar qué columna corresponde a cada campo clínico estándar.
2. Detectar problemas de calidad de datos.
3. Identificar filas que NO son datos de pacientes (totales, notas, medias).
4. Proponer un mapeo de columnas a campos estándar.

Campos estándar disponibles: nhc, patientName, birthDate, age, sex, phone, email, idDocument, idDocType, address, bloodType, emergencyContactName, emergencyContactPhone, emergencyContactRelationship, notes, admissionDate, consultationDate, diagnosis, diagnosisCodes, procedure, chiefComplaint, currentIllness, physicalExam, assessment, plan, followUpDate, followUpNotes, surgeryDate, testType, requestDate, completionDate, consultationType, surgeryStatus, asa, anesthesiaType, technique, findings, complications, postOpNotes, outcome, hospitalStayDays, surgeryDurationMinutes.
- testType: tipo de prueba o estudio (EMG, TAC, audiometría, análisis, etc.).
- requestDate: fecha en que se solicitó la prueba.
- completionDate: fecha en que se realizó la prueba.
- phone: teléfono del paciente; email: correo electrónico; idDocument: documento de identidad; idDocType: tipo de documento; address: dirección; bloodType: grupo sanguíneo.
- emergencyContactName, emergencyContactPhone y emergencyContactRelationship: nombre, teléfono y relación del contacto de emergencia.
- notes: notas asociadas al paciente.
- consultationDate: fecha de la consulta; chiefComplaint: motivo de consulta; currentIllness: enfermedad actual; physicalExam: exploración física; assessment: valoración; plan: plan clínico; followUpDate y followUpNotes: seguimiento.
- diagnosisCodes: texto de códigos diagnósticos tal como aparece en el archivo. No inventes ni valides códigos; conserva el texto importado.
- surgeryDate: fecha de cirugía; asa: clasificación ASA; anesthesiaType: tipo de anestesia; technique: técnica quirúrgica; findings: hallazgos; complications: complicaciones; postOpNotes: notas postoperatorias; outcome: resultado.
- hospitalStayDays: tiempo de hospitalización, expresado en días.
- surgeryDurationMinutes: tiempo quirúrgico, expresado en minutos.
Estos dos campos pueden aparecer como números o como texto con unidad, por ejemplo "3", "3 días", "138" o "138 min".
Las columnas de teléfono no se ignoran automáticamente: deben mapearse a "phone" o a "emergencyContactPhone" cuando el contexto permita identificarlo.
Las columnas desconocidas se mapean como "custom"; solo las columnas claramente irrelevantes o no deseadas se mapean como "ignore".

Responde SOLO con un objeto JSON válido. Sin texto adicional, sin markdown, sin explicación.`;

@Injectable()
export class ClaudeStructuredAnalyzer implements StructuredAnalysisProvider {
  private readonly logger = new Logger(ClaudeStructuredAnalyzer.name);
  private readonly client: Anthropic | null;
  readonly name = 'claude' as const;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get modelName(): string {
    return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async analyzeStructure(sample: FileSample): Promise<ColumnMappingProposal> {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY is not configured — Claude structured analysis unavailable.');
    }

    const userPrompt = this.buildUserPrompt(sample);

    this.logger.log(`Analyzing file structure with Claude model ${this.modelName}`);

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      temperature: 0,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    if (!text) {
      throw new Error('Claude returned an empty response.');
    }

    return this.parseProposal(text);
  }

  private buildUserPrompt(sample: FileSample): string {
    const sampleRows = sample.rows
      .slice(0, 20)
      .map((row) => sample.columns.map((col) => `${col}: ${row[col] ?? ''}`).join(' | '))
      .join('\n');

    return [
      `Columnas del archivo: ${sample.columns.join(', ')}`,
      '',
      'Primeras filas (pipeline-separated):',
      sampleRows || '(sin filas)',
      '',
      'Devuelve un JSON con esta estructura exacta:',
      '{',
       '  "columnMapping": { "NombreColumnaOriginal": "nhc" | "patientName" | "birthDate" | "age" | "sex" | "phone" | "email" | "idDocument" | "idDocType" | "address" | "bloodType" | "emergencyContactName" | "emergencyContactPhone" | "emergencyContactRelationship" | "notes" | "admissionDate" | "consultationDate" | "diagnosis" | "diagnosisCodes" | "procedure" | "chiefComplaint" | "currentIllness" | "physicalExam" | "assessment" | "plan" | "followUpDate" | "followUpNotes" | "surgeryDate" | "testType" | "requestDate" | "completionDate" | "consultationType" | "surgeryStatus" | "asa" | "anesthesiaType" | "technique" | "findings" | "complications" | "postOpNotes" | "outcome" | "hospitalStayDays" | "surgeryDurationMinutes" | "custom" | "ignore" },',
      '  "customFieldNames": { "NombreColumnaOriginal": "nombre legible" },',
      '  "junkRowIndices": [índices de filas basura],',
      '  "issues": ["descripción del problema"],',
      '  "confidence": 0.0-1.0,',
      '  "notes": "observaciones para el médico"',
      '}',
    ].join('\n');
  }

  private parseProposal(content: string): ColumnMappingProposal {
    const cleaned = content.replace(/```json|```/g, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Claude returned non-JSON content: ${(err as Error).message}`);
    }
    const result = ColumnMappingProposalSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(`Claude response failed Zod validation: ${result.error.message}`);
      throw new Error('Claude response did not match the expected ColumnMappingProposal schema.');
    }
    return { ...result.data, provider: 'claude' };
  }
}
