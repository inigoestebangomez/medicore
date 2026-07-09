// apps/api/src/infrastructure/billing/ai-provider/ollama.provider.ts
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AiProvider, ReportGenerationInput } from './ai-provider.interface';

/**
 * Optional local/Ollama provider. v1 ships a stub that delegates to a local
 * OLLAMA_BASE_URL endpoint if configured, otherwise throws NotImplemented so
 * misconfiguration fails loudly rather than silently.
 */
@Injectable()
export class OllamaProvider implements AiProvider {
  get modelName(): string {
    return process.env.OLLAMA_MODEL ?? 'ollama-local';
  }

  async generateReport(_input: ReportGenerationInput): Promise<string> {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    if (!baseUrl) {
      throw new NotImplementedException('OllamaProvider selected but OLLAMA_BASE_URL not set');
    }
    const model = this.modelName;
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Generate a clinical report for: ${JSON.stringify(_input)}`,
        stream: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { response?: string };
    return data.response ?? '';
  }
}