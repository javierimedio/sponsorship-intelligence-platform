// src/infrastructure/ai/openai-provider.ts
// Tercera implementación del puerto AIProvider, usando la API de OpenAI.
// Mismo contrato que AnthropicProvider y GeminiProvider — ningún caso de uso
// ni componente de dominio se entera de cuál está activo.

import OpenAI from 'openai';
import {
  AIProvider,
  EconomicConceptInput,
  EconomicConceptResult,
  RiskFactorInput,
  RiskFactorResult,
  ScoringAttributeInput,
  ScoringAttributeResult,
} from '../../domain/shared/ai-provider';

// Los nombres de modelo de OpenAI también cambian. Si 'gpt-4o-mini' deja de estar
// disponible o conviene otro por coste/calidad, consulta https://platform.openai.com/docs/models
const MODEL = 'gpt-4o-mini';

function getClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

async function askOpenAiForJson(
  system: string,
  userText: string,
  file?: { buffer: Buffer; mediaType: string },
): Promise<unknown> {
  const client = getClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  if (file) {
    if (file.mediaType === 'application/pdf') {
      // La API de Chat Completions de OpenAI no acepta PDFs directamente como input_file
      // en este endpoint — se envía como archivo adjunto vía Files API en una iteración
      // futura. Por ahora, para PDFs, avisamos con un error claro en vez de fallar en silencio.
      throw new Error(
        'El adapter de OpenAI todavía no soporta PDF directamente. Usa una imagen (PNG/JPG) ' +
          'o cambia AI_PROVIDER a "anthropic"/"gemini" para documentos PDF.',
      );
    }
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mediaType};base64,${file.buffer.toString('base64')}` },
    });
  }
  content.push({ type: 'text', text: userText });

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`OpenAI no devolvió JSON válido: ${cleaned.slice(0, 200)}`);
  }
}

export class OpenAiProvider implements AIProvider {
  async extractProposalData(fileBuffer: Buffer, mediaType: string): Promise<Record<string, unknown>> {
    const system =
      'Eres el Agente de Extracción de una plataforma de gestión de patrocinios. ' +
      'Lee el documento y devuelve ÚNICAMENTE un objeto JSON con esta forma exacta: ' +
      '{"requester_name": string|null, "requester_org": string|null, ' +
      '"collaboration_type": string|null, "summary": string, "assets_offered": string[], ' +
      '"estimated_total_amount": number|null, "currency": string|null, ' +
      '"opportunities": string[], "risks": string[], "website": string|null, ' +
      '"social_facebook": string|null, "social_instagram": string|null, "social_youtube": string|null}. ' +
      'Si un dato no aparece en el documento, usa null. No inventes datos que no estén en el texto.';

    const result = await askOpenAiForJson(
      system,
      'Extrae la información de este documento de propuesta de colaboración.',
      { buffer: fileBuffer, mediaType },
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
      'Devuelve ÚNICAMENTE un objeto JSON con la forma {"results": [{"attributeId": string, ' +
      '"score": number, "rationale": string}]}. El "score" nunca debe superar el "maxScore".';

    const result = (await askOpenAiForJson(system, JSON.stringify({ extractedData, attributes }))) as {
      results?: ScoringAttributeResult[];
    };
    return result.results ?? [];
  }

  async evaluateRiskFactors(
    extractedData: Record<string, unknown>,
    factors: RiskFactorInput[],
  ): Promise<RiskFactorResult[]> {
    if (!factors.length) return [];

    const system =
      'Eres el Agente de Riesgo de una plataforma de gestión de patrocinios. ' +
      'Para cada factor de riesgo, evalúa su "level" (probabilidad) e "impact" (gravedad) ' +
      'usando SOLO "Alto", "Medio" o "Bajo". ' +
      'IMPORTANTE: si el documento no menciona ninguna evidencia textual concreta relacionada ' +
      'con un factor, marca ese factor como "Bajo"/"Bajo" por defecto — nunca asignes un nivel ' +
      'superior a "Bajo" sin poder señalar qué frase del documento lo justifica. No inventes ' +
      'riesgos por prudencia ni por parecer exhaustivo: la ausencia de mención de un riesgo no ' +
      'es evidencia de ese riesgo. ' +
      'Devuelve ÚNICAMENTE un objeto JSON con la forma ' +
      '{"results": [{"factorId": string, "level": "Alto"|"Medio"|"Bajo", "impact": "Alto"|"Medio"|"Bajo"}]}.';

    const result = (await askOpenAiForJson(system, JSON.stringify({ extractedData, factors }))) as {
      results?: RiskFactorResult[];
    };
    return result.results ?? [];
  }

  async extractFinancialLines(
    extractedData: Record<string, unknown>,
    concepts: EconomicConceptInput[],
  ): Promise<EconomicConceptResult[]> {
    if (!concepts.length) return [];

    const system =
      'Eres el Agente de ROI/Financials de una plataforma de gestión de patrocinios. ' +
      'Para cada concepto económico, estima su importe en euros. Si no hay datos suficientes, ' +
      'usa null. Devuelve ÚNICAMENTE un objeto JSON con la forma ' +
      '{"results": [{"conceptId": string, "estimatedAmount": number|null}]}.';

    const result = (await askOpenAiForJson(system, JSON.stringify({ extractedData, concepts }))) as {
      results?: EconomicConceptResult[];
    };
    return result.results ?? [];
  }
}
