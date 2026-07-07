// src/infrastructure/ai/get-ai-provider.ts
// Único punto de decisión sobre qué proveedor de IA se usa. Cambiar de Gemini a Claude
// (o viceversa) es cambiar la variable de entorno AI_PROVIDER — nada de código.

import { AIProvider } from '../../domain/shared/ai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GeminiProvider } from './gemini-provider';

export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase();

  if (provider === 'anthropic') {
    return new AnthropicProvider();
  }

  // 'gemini' es el valor por defecto: capa gratuita, sin coste mientras se valida el MVP.
  return new GeminiProvider();
}
