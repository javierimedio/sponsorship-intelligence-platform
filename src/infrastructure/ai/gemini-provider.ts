// src/infrastructure/ai/gemini-provider.ts
// Implementación alternativa del puerto AIProvider usando Gemini (capa gratuita de Google)
// en vez de Claude. Ningún caso de uso ni componente de dominio se entera del cambio —
// solo cambia qué clase se instancia en get-ai-provider.ts.

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  EconomicConceptInput,
  EconomicConceptResult,
  RiskFactorInput,
  RiskFactorResult,
  ScoringAttributeInput,
  ScoringAttributeResult,
} from '../../domain/shared/ai-provider';

// Los nombres de modelo de Gemini cambian con cierta frecuencia. Si esta versión deja
// de estar disponible en la capa gratuita, consulta https://ai.google.dev/gemini-api/docs/models
// para ver el modelo gratuito vigente y actualiza esta constante — es el único sitio
// donde hay que tocarlo.
const MODEL = 'gemini-2.0-flash';

function getModel(systemInstruction: string) {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return client.getGenerativeModel({ model: MODEL, systemInstruction });
}

async function askGeminiForJson(
  systemInstruction: string,
  userText: string,
  file?: { buffer: Buffer; mediaType: string },
): Promise<unknown> {
  const model = getModel(systemInstruction);

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (file) {
    parts.push({ inlineData: { mimeType: file.mediaType, data: file.buffer.toString('base64') } });
  }
  parts.push({ text: userText });

  const result = await model.generateContent(parts);
  const raw = result.response.text();
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini no devolvió JSON válido: ${cleaned.slice(0, 200)}`);
  }
}

export class GeminiProvider implements AIProvider {
  async extractProposalData(fileBuffer: Buffer, mediaType: string): Promise<Record<string, unknown>> {
    const system =
      'Eres el Agente de Extracción de una plataforma de gestión de patrocinios. ' +
      'Lee el documento y devuelve ÚNICAMENTE un objeto JSON (sin texto adicional, sin markdown) ' +
      'con esta forma exacta: {"requester_name": string|null, "requester_org": string|null, ' +
      '"collaboration_type": string|null, "summary": string, "assets_offered": string[], ' +
      '"estimated_total_amount": number|null, "currency": string|null, ' +
      '"opportunities": string[], "risks": string[], "website": string|null, ' +
      '"social_facebook": string|null, "social_instagram": string|null, "social_youtube": string|null}. ' +
      'Si un dato no aparece en el documento, usa null. No inventes datos que no estén en el texto.';

    const result = await askGeminiForJson(
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
      'Devuelve ÚNICAMENTE un array JSON (sin texto adicional, sin markdown) con objetos ' +
      '{"attributeId": string, "score": number, "rationale": string}. ' +
      'El "score" nunca debe superar el "maxScore" indicado para ese atributo.';

    const result = await askGeminiForJson(system, JSON.stringify({ extractedData, attributes }));
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
      'Devuelve ÚNICAMENTE un array JSON (sin texto adicional, sin markdown) con objetos ' +
      '{"factorId": string, "level": "Alto"|"Medio"|"Bajo", "impact": "Alto"|"Medio"|"Bajo"}.';

    const result = await askGeminiForJson(system, JSON.stringify({ extractedData, factors }));
    return Array.isArray(result) ? (result as RiskFactorResult[]) : [];
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

    const result = await askGeminiForJson(system, JSON.stringify({ extractedData, concepts }));
    return Array.isArray(result) ? (result as EconomicConceptResult[]) : [];
  }
}
