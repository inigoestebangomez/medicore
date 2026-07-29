// apps/api/src/infrastructure/ai/structured-analysis/groq-analyzer.provider.ts
// Groq-hosted Llama 3 analyzer — free tier, ~1s latency. Called only when the
// heuristic analyzer's confidence is below 0.7. Uses Groq's OpenAI-compatible
// chat completion endpoint with JSON mode. If GROQ_API_KEY is unset or the
// request fails, `analyzeStructure` throws — the orchestrator falls through to
// the next provider (Claude) gracefully (AD-2).

import { Injectable, Logger } from '@nestjs/common';
import {
  ColumnMappingProposalSchema,
  type ColumnMappingProposal,
  type FileSample,
} from '@medicore/contracts';
import type { StructuredAnalysisProvider } from './structured-analysis.provider';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Eres un asistente especializado en analizar bases de datos médicas de hospitales españoles.
Recibirás las columnas y las primeras filas de un archivo Excel de un médico y debes:
1. Identificar qué columna corresponde a cada campo clínico estándar.
2. Detectar problemas de calidad de datos.
3. Identificar filas que NO son datos de pacientes (totales, notas, medias).
4. Proponer un mapeo de columnas a campos estándar.

Campos estándar disponibles: nhc, patientName, birthDate, age, sex, admissionDate, diagnosis, procedure, testType, requestDate, completionDate.
- testType: tipo de prueba o estudio (EMG, TAC, audiometría, análisis, etc.).
- requestDate: fecha en que se solicitó la prueba.
- completionDate: fecha en que se realizó la prueba.
Cualquier campo que NO sea de teléfono ni uno de los anteriores se mapea como "custom".
Los campos de teléfono (Teléfono, Móvil, Tlf, Phone) SIEMPRE se mapean como "ignore" — RGPD.

Responde SOLO con JSON válido, sin texto adicional ni markdown.`;

@Injectable()
export class GroqAnalyzer implements StructuredAnalysisProvider {
  private readonly logger = new Logger(GroqAnalyzer.name);
  readonly name = 'groq' as const;

  get modelName(): string {
    return process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  }

  /** Groq is available only if an API key was provided. */
  isAvailable(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
  }

  async analyzeStructure(sample: FileSample): Promise<ColumnMappingProposal> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured — falling through to next provider.');
    }

    const userPrompt = this.buildUserPrompt(sample);

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Groq API error ${response.status}: ${detail.slice(0, 200)}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) {
      throw new Error('Groq returned an empty response.');
    }

    return this.parseProposal(content);
  }

  private buildUserPrompt(sample: FileSample): string {
    const sampleRows = sample.rows
      .slice(0, 20)
      .map((row) =>
        sample.columns.map((col) => `${col}: ${row[col] ?? ''}`).join(' | '),
      )
      .join('\n');

    return [
      `Columnas del archivo: ${sample.columns.join(', ')}`,
      '',
      'Primeras filas (pipeline-separated):',
      sampleRows || '(sin filas)',
      '',
      'Devuelve un JSON con esta estructura exacta:',
      '{',
      '  "columnMapping": { "NombreColumnaOriginal": "nhc" | "patientName" | "birthDate" | "age" | "sex" | "admissionDate" | "diagnosis" | "procedure" | "testType" | "requestDate" | "completionDate" | "custom" | "ignore" },',
      '  "customFieldNames": { "NombreColumnaOriginal": "nombre legible" },',
      '  "junkRowIndices": [índices de filas basura],',
      '  "issues": ["descripción del problema"],',
      '  "confidence": 0.0-1.0,',
      '  "notes": "observaciones para el médico"',
      '}',
    ].join('\n');
  }

  private parseProposal(content: string): ColumnMappingProposal {
    // The model may wrap JSON in code fences despite the instruction.
    const cleaned = content.replace(/```json|```/g, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Groq returned non-JSON content: ${(err as Error).message}`);
    }
    const result = ColumnMappingProposalSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(`Groq response failed Zod validation: ${result.error.message}`);
      throw new Error('Groq response did not match the expected ColumnMappingProposal schema.');
    }
    return { ...result.data, provider: 'groq' };
  }
}