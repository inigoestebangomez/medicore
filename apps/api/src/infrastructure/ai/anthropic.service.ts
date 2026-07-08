import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface ReportGenerationInput {
  patientName: string;
  patientNhc: string;
  consultationType: string;
  chiefComplaint: string;
  currentIllness?: string;
  physicalExam?: Record<string, unknown>;
  assessment?: string;
  diagnosisCodes?: Array<{ system: string; code: string; description: string; type: string }>;
  plan?: string;
  surgeryType?: string;
  surgeryFindings?: string;
  relevantHistory?: string;
}

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — AI report generation will fail');
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateReport(input: ReportGenerationInput): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured. AI report generation is unavailable.');
    }

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
    const systemPrompt = this.buildSystemPrompt();
    const userMessage = this.buildUserMessage(input);

    this.logger.log(`Generating report for patient ${input.patientNhc} with model ${model}`);

    const message = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    this.logger.log(`Report generated successfully (${text.length} chars)`);
    return text;
  }

  private buildSystemPrompt(): string {
    return `You are an expert otorhinolaryngology (ENT) clinical assistant.
Generate professional, structured medical reports in Spanish.
Follow this format:

# INFORME CLÍNICO

## Datos del paciente
- Nombre: [patient name]
- NHC: [NHC]

## Motivo de consulta
[chief complaint]

## Antecedentes
[relevant history / current illness]

## Exploración física
[physical exam findings in narrative form]

## Diagnóstico
[List diagnoses with ICD-10 codes]

## Plan terapéutico
[treatment plan]

## Observaciones
[any additional notes]

Use professional medical language. Be concise but thorough.
ALWAYS include a disclaimer: "Este informe ha sido generado con asistencia de IA y debe ser revisado por un médico antes de su firma."`;
  }

  private buildUserMessage(input: ReportGenerationInput): string {
    const parts: string[] = [];

    parts.push(`Paciente: ${input.patientName} (NHC: ${input.patientNhc})`);
    parts.push(`Tipo de consulta: ${input.consultationType}`);

    if (input.chiefComplaint) {
      parts.push(`Motivo: ${input.chiefComplaint}`);
    }

    if (input.currentIllness) {
      parts.push(`Enfermedad actual: ${input.currentIllness}`);
    }

    if (input.physicalExam && Object.keys(input.physicalExam).length > 0) {
      parts.push(`Exploración física: ${JSON.stringify(input.physicalExam, null, 2)}`);
    }

    if (input.assessment) {
      parts.push(`Impresión diagnóstica: ${input.assessment}`);
    }

    if (input.diagnosisCodes && input.diagnosisCodes.length > 0) {
      const codes = input.diagnosisCodes
        .map((d) => `  - ${d.code} (${d.system}): ${d.description} [${d.type}]`)
        .join('\n');
      parts.push(`Códigos diagnósticos:\n${codes}`);
    }

    if (input.plan) {
      parts.push(`Plan: ${input.plan}`);
    }

    if (input.surgeryType) {
      parts.push(`Procedimiento quirúrgico: ${input.surgeryType}`);
      if (input.surgeryFindings) {
        parts.push(`Hallazgos quirúrgicos: ${input.surgeryFindings}`);
      }
    }

    if (input.relevantHistory) {
      parts.push(`Contexto adicional: ${input.relevantHistory}`);
    }

    parts.push('\nGenera un informe clínico estructurado basado en esta información.');

    return parts.join('\n\n');
  }
}
