// apps/api/src/infrastructure/billing/ai-provider/open-code-go.provider.ts
import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AiProvider, ReportGenerationInput } from './ai-provider.interface';

/**
 * Hooks into an OpenCode/Go-backed model gateway when AI_PROVIDER=open-code-go.
 * v1 stub: delegates to a configured OPencode endpoint if present, otherwise
 * throws so misconfiguration is loud.
 */
@Injectable()
export class OpenCodeGoProvider implements AiProvider {
  get modelName(): string {
    return process.env.OPEN_CODE_GO_MODEL ?? 'opencode-go';
  }

  async generateReport(_input: ReportGenerationInput): Promise<string> {
    const baseUrl = process.env.OPEN_CODE_GO_BASE_URL;
    if (!baseUrl) {
      throw new NotImplementedException(
        'OpenCodeGoProvider selected but OPEN_CODE_GO_BASE_URL not set',
      );
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.modelName, input: _input }),
    });
    if (!res.ok) {
      throw new Error(`open-code-go request failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { text?: string; content?: string };
    return data.text ?? data.content ?? '';
  }
}