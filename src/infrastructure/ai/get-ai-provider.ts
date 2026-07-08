// src/infrastructure/ai/get-ai-provider.ts
// Único punto de decisión sobre qué proveedor de IA se usa. AI_PROVIDER (variable de
// entorno) es el valor POR DEFECTO del servidor, pero cada llamada puede pedir
// explícitamente un proveedor distinto — es lo que permite el selector en /intake.

import { AIProvider } from '../../domain/shared/ai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAiProvider } from './openai-provider';

export function getAIProvider(providerOverride?: string): AIProvider {
  const provider = (providerOverride ?? process.env.AI_PROVIDER ?? 'gemini').toLowerCase();

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

  return new GeminiProvider();
}
