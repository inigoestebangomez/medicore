// apps/api/src/infrastructure/billing/ai-provider/ai-provider.module.ts
import { Module, DynamicModule, Logger } from '@nestjs/common';
import { AnthropicModule } from '@/infrastructure/ai/anthropic.module';
import { ClaudeProvider } from './claude.provider';
import { OllamaProvider } from './ollama.provider';
import { OpenCodeGoProvider } from './open-code-go.provider';
import { AI_PROVIDER } from './ai-provider.interface';

/**
 * Selects the active AiProvider implementation based on the AI_PROVIDER env
 * var (defaults to "claude"). Each provider must be registered conditionally;
 * AnthropicModule is only imported for the Claude path so an Anthropic-only
 * install isn't forced on a pure local-Ollama deployment.
 */
@Module({})
export class AiProviderModule {
  static register(): DynamicModule {
    const provider = (process.env.AI_PROVIDER ?? 'claude').toLowerCase();
    const logger = new Logger('AiProviderModule');

    let impl: any;
    switch (provider) {
      case 'claude':
        impl = ClaudeProvider;
        break;
      case 'ollama':
        impl = OllamaProvider;
        break;
      case 'open-code-go':
      case 'opencode-go':
      case 'opencodego':
        impl = OpenCodeGoProvider;
        break;
      default:
        logger.warn(`Unknown AI_PROVIDER "${provider}" — falling back to claude`);
        impl = ClaudeProvider;
    }

    const needsAnthropic = impl === ClaudeProvider;

    return {
      module: AiProviderModule,
      imports: needsAnthropic ? [AnthropicModule] : [],
      providers: [{ provide: AI_PROVIDER, useClass: impl }],
      exports: [AI_PROVIDER],
    };
  }
}