// src/infrastructure/ai/anthropic-provider.ts
// Implementación concreta del puerto AIProvider usando Claude.
// Sustituir por OpenAI (u otro) es escribir esta misma interfaz en otro archivo —
// ningún caso de uso ni componente de dominio se entera del cambio.

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  EconomicConceptInput,
  EconomicConceptResult,
  RiskFactorInput,
  RiskFactorResult,
  ScoringAttributeInput,
  ScoringAttributeResult,
} from '../../domain/shared/ai-provider';

const MODEL = 'claude-sonnet-5';

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

async function askClaudeForJson(
  system: string,
  userText: string,
  files?: { buffer: Buffer; mediaType: string }[],
): Promise<unknown> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  for (const file of files ?? []) {
    if (file.mediaType === 'application/pdf') {
      // Claude solo acepta application/pdf en el bloque "document" — cualquier imagen
      // (jpg/png) tiene que ir por el bloque "image", si no la API la rechaza.
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: file.mediaType, data: file.buffer.toString('base64') },
      });
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mediaType, data: file.buffer.toString('base64') },
      });
    }
  }
  content.push({ type: 'text', text: userText });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '{}';
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`El modelo no devolvió JSON válido: ${cleaned.slice(0, 200)}`);
  }
}

export class AnthropicProvider implements AIProvider {
  async enrichWithWebSearch(): Promise<string> {
    // Anthropic sí soporta búsqueda web nativa (web_search_20250305) — pendiente de
    // implementar y validar aquí. Se empezó por OpenAI porque es el único proveedor con
    // facturación activa disponible para probarlo con casos reales.
    throw new Error('El enriquecimiento con búsqueda web todavía no está implementado para Anthropic — usa OpenAI por ahora.');
  }

  async extractProposalData(files: { buffer: Buffer; mediaType: string }[]): Promise<Record<string, unknown>> {
    const system =
      'Eres el Agente de Extracción de una plataforma de gestión de patrocinios. ' +
      'Puede que recibas varios archivos (por ejemplo, un dossier convertido página por ' +
      'página a varias imágenes) — léelos TODOS como un único documento combinado, no solo ' +
      'el primero. ' +
      'Lee el documento y devuelve ÚNICAMENTE un objeto JSON (sin texto adicional, sin markdown) ' +
      'con esta forma exacta: {"requester_name": string|null, "requester_org": string|null, ' +
      '"collaboration_type": string|null, "summary": string, "assets_offered": string[], ' +
      '"estimated_total_amount": number|null, "currency": string|null, ' +
      '"opportunities": string[], "risks": string[], "website": string|null, ' +
      '"social_facebook": string|null, "social_instagram": string|null, "social_youtube": string|null}. ' +
      'Si un dato no aparece en el documento, usa null. No inventes datos que no estén en el texto.';

    const result = await askClaudeForJson(
      system,
      'Extrae la información de este documento de propuesta de colaboración (puede venir en varios archivos).',
      files,
    );
    return result as Record<string, unknown>;
  }

  async scoreAttributes(
    extractedData: Record<string, unknown>,
    attributes: ScoringAttributeInput[],
  ): Promise<ScoringAttributeResult[]> {
    if (!attributes.length) return [];

    const system =
      'Eres el Agente de Evaluación de una plataforma de gestión de patrocinios. ' +
      'Para cada atributo de la lista, puntúa entre 0 y su maxScore según la información extraída. ' +
      'IMPORTANTE: si el documento no aporta evidencia suficiente sobre un atributo concreto, ' +
      'puntúa con un valor cercano a 0 en vez de asumir un valor intermedio "razonable" — no ' +
      'inventes ni asumas datos que no estén en el texto. Justifica cada puntuación en el ' +
      '"rationale" citando qué parte del documento la sustenta. ' +
      'Devuelve ÚNICAMENTE un array JSON (sin texto adicional, sin markdown) con objetos ' +
      '{"attributeId": string, "score": number, "rationale": string}. ' +
      'El "score" nunca debe superar el "maxScore" indicado para ese atributo.';

    const result = await askClaudeForJson(system, JSON.stringify({ extractedData, attributes }));
    return Array.isArray(result) ? (result as ScoringAttributeResult[]) : [];
  }

  async evaluateRiskFactors(
    extractedData: Record<string, unknown>,
    factors: RiskFactorInput[],
  ): Promise<RiskFactorResult[]> {
    if (!factors.length) return [];

    const system =
      'Eres el Agente de Riesgo de una plataforma de gestión de patrocinios. ' +
      'Para cada factor de riesgo de la lista, evalúa su "level" (probabilidad) e "impact" ' +
      '(gravedad) según la información extraída, usando SOLO "Alto", "Medio" o "Bajo". ' +
      'IMPORTANTE: si el documento no menciona ninguna evidencia textual concreta relacionada ' +
      'con un factor, marca ese factor como "Bajo"/"Bajo" por defecto — nunca asignes un nivel ' +
      'superior a "Bajo" sin poder señalar qué frase del documento lo justifica. No inventes ' +
      'riesgos por prudencia ni por parecer exhaustivo: la ausencia de mención de un riesgo no ' +
      'es evidencia de ese riesgo. ' +
      'EXCEPCIÓN A LA REGLA ANTERIOR: hay factores que preguntan por la AUSENCIA de algo ' +
      'positivo (por ejemplo "Sin reporting", "Sin métricas", "Sin tracking", "KPIs ambiguos", ' +
      '"ROI incierto o difícil de medir"). Para ESOS factores, que el documento no mencione ' +
      'ningún mecanismo de reporting/medición/KPI/cálculo de ROI SÍ es evidencia real del ' +
      'riesgo — en ese caso marca un nivel alto, no "Bajo" por defecto. La regla de "sin ' +
      'evidencia, Bajo" aplica a riesgos sobre la PRESENCIA de algo malo, no a estos. ' +
      'Devuelve ÚNICAMENTE un array JSON (sin texto adicional, sin markdown) con objetos ' +
      '{"factorId": string, "level": "Alto"|"Medio"|"Bajo", "impact": "Alto"|"Medio"|"Bajo"}.';

    const result = await askClaudeForJson(system, JSON.stringify({ extractedData, factors }));
    return Array.isArray(result) ? (result as RiskFactorResult[]) : [];
  }

  async suggestActivations(
    extractedData: Record<string, unknown>,
    catalogItems: import('../../domain/shared/ai-provider').ActivationCatalogItemInput[],
    channels: import('../../domain/shared/ai-provider').ChannelInput[],
  ): Promise<import('../../domain/shared/ai-provider').ActivationSuggestionResult[]> {
    if (!catalogItems.length) return [];

    const system =
      'Eres el Agente de Activación de una plataforma de gestión de patrocinios. ' +
      'A partir de los datos extraídos del documento, sugiere qué acciones del CATÁLOGO ' +
      'CERRADO que se te da tienen sentido para esta colaboración concreta. ' +
      'IMPORTANTE: nunca inventes una acción que no esté en el catálogo. No sugieras todas ' +
      'las acciones del catálogo por sistema — solo las que de verdad encajen con lo que dice ' +
      'el documento (assets ofrecidos, tipo de colaboración, oportunidades mencionadas). Es ' +
      'preferible sugerir pocas acciones bien justificadas que una lista larga genérica. Para ' +
      'cada acción sugerida, asigna una prioridad ("Alta"|"Media"|"Baja") según su relevancia ' +
      'real para esta colaboración, un canal del catálogo de canales si aplica claramente, y ' +
      'un objetivo/descripción breves basados en lo que dice el documento — no en suposiciones. ' +
      'Devuelve ÚNICAMENTE un array JSON (sin texto adicional, sin markdown) con objetos ' +
      '{"activationCatalogItemId": string, "channelId": string|null, "objective": string|null, ' +
      '"description": string|null, "priority": "Alta"|"Media"|"Baja"}.';

    const result = await askClaudeForJson(system, JSON.stringify({ extractedData, catalogItems, channels }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Array.isArray(result) ? (result as any[]) : [];
  }

  async extractFinancialLines(
    extractedData: Record<string, unknown>,
    concepts: EconomicConceptInput[],
  ): Promise<EconomicConceptResult[]> {
    if (!concepts.length) return [];

    const system =
      'Eres el Agente de ROI/Financials de una plataforma de gestión de patrocinios. ' +
      'Para cada concepto económico de la lista, estima su importe en euros según la ' +
      'información extraída. Si no hay datos suficientes, usa null — no inventes cifras. ' +
      'Devuelve ÚNICAMENTE un array JSON (sin texto adicional, sin markdown) con objetos ' +
      '{"conceptId": string, "estimatedAmount": number|null}.';

    const result = await askClaudeForJson(system, JSON.stringify({ extractedData, concepts }));
    return Array.isArray(result) ? (result as EconomicConceptResult[]) : [];
  }
}
