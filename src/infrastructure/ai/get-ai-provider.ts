// src/infrastructure/ai/get-ai-provider.ts
// Único punto de decisión sobre qué proveedor de IA se usa. Cambiar entre Gemini, Claude
// u OpenAI es cambiar la variable de entorno AI_PROVIDER — nada de código.

import { AIProvider } from '../../domain/shared/ai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAiProvider } from './openai-provider';

export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase();

  if (provider === 'manual') {
    throw new Error(
      "AI_PROVIDER='manual' no debe llegar a instanciar un proveedor de IA — el modo manual " +
        'se gestiona en la UI (/intake) llamando a /api/extractions/manual y /api/evaluations/manual, ' +
        'nunca a estos endpoints automáticos.',
    );
  }

  if (provider === 'anthropic') {
    return new AnthropicProvider();
  }

  if (provider === 'openai') {
    return new OpenAiProvider();
  }

  // 'gemini' es el valor por defecto — pero recuerda que su capa gratuita no está
  // disponible en España, así que probablemente necesites cambiar esto a 'openai'.
  return new GeminiProvider();
}
