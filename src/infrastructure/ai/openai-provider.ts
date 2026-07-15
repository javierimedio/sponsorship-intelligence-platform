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
  files?: { buffer: Buffer; mediaType: string }[],
): Promise<unknown> {
  const client = getClient();

  const allFiles = files ?? [];
  const imageFiles = allFiles.filter((f) => f.mediaType !== 'application/pdf');
  const hasPdf = allFiles.some((f) => f.mediaType === 'application/pdf');

  if (hasPdf && !imageFiles.length) {
    // La API de Chat Completions de OpenAI no acepta PDFs directamente en este endpoint.
    // Si además hay imágenes disponibles, se ignoran los PDF y se usan esas — solo se
    // avisa con error cuando NO queda ninguna imagen utilizable.
    throw new Error(
      'El adapter de OpenAI todavía no soporta PDF directamente. Usa una imagen (PNG/JPG) ' +
        'o cambia AI_PROVIDER a "anthropic"/"gemini" para documentos PDF.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = imageFiles.map((file) => ({
    type: 'image_url',
    image_url: { url: `data:${file.mediaType};base64,${file.buffer.toString('base64')}` },
  }));
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
  async enrichWithWebSearch(input: import('../../domain/shared/ai-provider').WebEnrichmentInput): Promise<string> {
    const client = getClient();

    const facts = [
      input.requesterName ? `Nombre/persona u organización solicitante: ${input.requesterName}` : null,
      input.website ? `Web: ${input.website}` : null,
      input.socialInstagram ? `Instagram: ${input.socialInstagram}` : null,
      input.socialFacebook ? `Facebook: ${input.socialFacebook}` : null,
      input.socialYoutube ? `YouTube: ${input.socialYoutube}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (!facts) return 'No hay ningún dato de partida (nombre, web o redes) con el que buscar información.';

    const prompt =
      'Eres el Agente de Enriquecimiento de una plataforma de gestión de patrocinios. ' +
      'Busca en internet información pública y verificable sobre el solicitante/colaborador ' +
      'descrito abajo, y crúzala con el encaje que podría tener con la marca indicada. ' +
      'IMPORTANTE: no inventes datos que no encuentres — si la búsqueda no da resultados ' +
      'fiables sobre algo, dilo explícitamente en vez de suponer. Cita de dónde sale cada dato ' +
      'que aportes (qué página o red social lo confirma). ' +
      'Responde en texto plano en español, en un párrafo o lista breve — nada de JSON. ' +
      'Cubre, solo si encuentras datos reales: repercusión pública/número de seguidores, otras ' +
      'colaboraciones o patrocinios conocidos, cualquier controversia pública relevante, y por ' +
      'qué podría (o no) encajar con la marca indicada.\n\n' +
      `Datos de partida:\n${facts}\n\n` +
      `Marca interesada en el patrocinio: ${input.brandName ?? 'no especificada'}`;

    // La Responses API (no la Chat Completions que usan el resto de agentes) es la que
    // expone la herramienta de búsqueda web nativa de OpenAI.
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
    });

    // El SDK expone un getter de conveniencia `output_text` que concatena el texto final;
    // si no estuviera disponible en esta versión del SDK, se reconstruye a mano.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResponse = response as any;
    if (typeof anyResponse.output_text === 'string' && anyResponse.output_text.trim()) {
      return anyResponse.output_text.trim();
    }
    const textParts: string[] = [];
    for (const item of anyResponse.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === 'string') textParts.push(part.text);
      }
    }
    return textParts.join('\n').trim() || 'La búsqueda no devolvió ningún resultado de texto.';
  }

  async recommendForBrand(input: import('../../domain/shared/ai-provider').BrandStrategyInput): Promise<string> {
    const client = getClient();

    const historyText = input.historicalBreakdown.length
      ? input.historicalBreakdown
          .map((h) => `- ${h.collaborationType}: ${h.count} propuesta(s), score medio ${Math.round(h.avgScore * 100)}%`)
          .join('\n')
      : 'Todavía no hay histórico suficiente de propuestas evaluadas para esta marca.';

    const prompt =
      'Eres el Agente Estratégico de una plataforma de gestión de patrocinios. ' +
      `Para la marca "${input.brandName}", recomienda qué tipos de patrocinios/colaboraciones ` +
      'debería buscar activamente, apoyándote en su ADN de marca y en el histórico real de ' +
      'abajo. ' +
      'IMPORTANTE: no inventes tipos de colaboración fuera de lo razonable a partir de ' +
      '"colaboraciones ideales" — puedes proponer variantes o combinaciones concretas de esas ' +
      'categorías, pero no inventes una categoría de patrocinio sin relación con el perfil de ' +
      'la marca. Si el histórico es insuficiente, dilo explícitamente y apóyate más en el ADN ' +
      'de marca y en tendencias generales verificables por búsqueda web. Cita de dónde sale ' +
      'cada dato que aportes de fuera del contexto que se te da. ' +
      'Responde en texto plano en español, en 3-5 párrafos breves o una lista — nada de JSON.\n\n' +
      `Posicionamiento: ${input.positioning ?? 'no especificado'}\n` +
      `Colaboraciones ideales: ${input.idealCollaborations?.join(', ') ?? 'no especificadas'}\n` +
      `Colaboraciones a evitar: ${input.avoidCollaborations?.join(', ') ?? 'no especificadas'}\n` +
      `Prioridades estratégicas: ${input.strategicPriorities?.join(', ') ?? 'no especificadas'}\n` +
      `Sesgo de evaluación: ${input.evaluationBias ?? 'no especificado'}\n` +
      `Estilo de decisión: ${input.decisionStyle ?? 'no especificado'}\n\n` +
      `Histórico real de propuestas evaluadas para esta marca:\n${historyText}`;

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResponse = response as any;
    if (typeof anyResponse.output_text === 'string' && anyResponse.output_text.trim()) {
      return anyResponse.output_text.trim();
    }
    const textParts: string[] = [];
    for (const item of anyResponse.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === 'string') textParts.push(part.text);
      }
    }
    return textParts.join('\n').trim() || 'La búsqueda no devolvió ningún resultado de texto.';
  }

  async completeBrandProfile(
    input: import('../../domain/shared/ai-provider').BrandProfileBasicInput,
  ): Promise<import('../../domain/shared/ai-provider').BrandProfileFields> {
    const client = getClient();

    const facts = [
      `Marca: ${input.brandName}`,
      input.website ? `Web: ${input.website}` : null,
      input.socialInstagram ? `Instagram: ${input.socialInstagram}` : null,
      input.socialFacebook ? `Facebook: ${input.socialFacebook}` : null,
      input.socialYoutube ? `YouTube: ${input.socialYoutube}` : null,
      input.businessModel ? `Perfil comercial (dado por la empresa): ${input.businessModel}` : null,
      input.targetAudience ? `Cliente potencial (dado por la empresa): ${input.targetAudience}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt =
      'Eres el Agente de Perfil de Marca de una plataforma de gestión de patrocinios. ' +
      'A partir de la información básica de abajo, busca en internet (web y redes de la ' +
      'marca) y propón el resto de su perfil estratégico para evaluar patrocinios. ' +
      'IMPORTANTE: no inventes datos que no puedas fundamentar en lo que encuentres o en la ' +
      'información básica dada — si algo no lo puedes fundamentar, deja el campo vacío ([] o ' +
      'null) en vez de rellenarlo con una suposición genérica. Todo lo que devuelvas quedará ' +
      'editable por una persona antes de guardarse, así que es preferible un campo vacío a uno ' +
      'inventado. ' +
      'Devuelve ÚNICAMENTE un objeto JSON con esta forma exacta: {"description": string|null, ' +
      '"positioning": string|null, "toneOfVoice": string|null, "marketingObjectives": string[], ' +
      '"evaluationFocus": string[], "recommendedActivations": string|null, ' +
      '"negotiationGuidelines": string|null, "idealCollaborations": string[], ' +
      '"avoidCollaborations": string[], "strategicPriorities": string[], "brandValues": string[], ' +
      '"successExamples": string[], "redFlags": string[], "evaluationBias": string|null, ' +
      '"preferredKpis": string[], "decisionStyle": string|null}.\n\n' +
      `Información básica:\n${facts}`;

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResponse = response as any;
    let text = typeof anyResponse.output_text === 'string' ? anyResponse.output_text.trim() : '';
    if (!text) {
      const textParts: string[] = [];
      for (const item of anyResponse.output ?? []) {
        for (const part of item.content ?? []) {
          if (typeof part.text === 'string') textParts.push(part.text);
        }
      }
      text = textParts.join('\n').trim();
    }

    // La búsqueda web puede envolver el JSON en texto o markdown a pesar de haberlo pedido
    // limpio — se extrae el primer bloque {...} en vez de asumir que el string entero es JSON.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La IA no devolvió un JSON reconocible: ' + text.slice(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      description: parsed.description ?? null,
      positioning: parsed.positioning ?? null,
      toneOfVoice: parsed.toneOfVoice ?? null,
      marketingObjectives: Array.isArray(parsed.marketingObjectives) ? parsed.marketingObjectives : [],
      evaluationFocus: Array.isArray(parsed.evaluationFocus) ? parsed.evaluationFocus : [],
      recommendedActivations: parsed.recommendedActivations ?? null,
      negotiationGuidelines: parsed.negotiationGuidelines ?? null,
      idealCollaborations: Array.isArray(parsed.idealCollaborations) ? parsed.idealCollaborations : [],
      avoidCollaborations: Array.isArray(parsed.avoidCollaborations) ? parsed.avoidCollaborations : [],
      strategicPriorities: Array.isArray(parsed.strategicPriorities) ? parsed.strategicPriorities : [],
      brandValues: Array.isArray(parsed.brandValues) ? parsed.brandValues : [],
      successExamples: Array.isArray(parsed.successExamples) ? parsed.successExamples : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      evaluationBias: parsed.evaluationBias ?? null,
      preferredKpis: Array.isArray(parsed.preferredKpis) ? parsed.preferredKpis : [],
      decisionStyle: parsed.decisionStyle ?? null,
    };
  }

  async extractProposalData(files: { buffer: Buffer; mediaType: string }[]): Promise<Record<string, unknown>> {
    const system =
      'Eres el Agente de Extracción de una plataforma de gestión de patrocinios. ' +
      'Puede que recibas varios archivos (por ejemplo, un dossier convertido página por ' +
      'página a varias imágenes) — léelos TODOS como un único documento combinado, no solo ' +
      'el primero. ' +
      'Lee el documento y devuelve ÚNICAMENTE un objeto JSON con esta forma exacta: ' +
      '{"requester_name": string|null, "requester_org": string|null, ' +
      '"collaboration_type": string|null, "summary": string, "assets_offered": string[], ' +
      '"estimated_total_amount": number|null, "currency": string|null, ' +
      '"opportunities": string[], "risks": string[], "website": string|null, ' +
      '"social_facebook": string|null, "social_instagram": string|null, "social_youtube": string|null}. ' +
      'Si un dato no aparece en el documento, usa null. No inventes datos que no estén en el texto.';

    const result = await askOpenAiForJson(
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
      'EXCEPCIÓN A LA REGLA ANTERIOR: hay factores que preguntan por la AUSENCIA de algo ' +
      'positivo (por ejemplo "Sin reporting", "Sin métricas", "Sin tracking", "KPIs ambiguos", ' +
      '"ROI incierto o difícil de medir"). Para ESOS factores, que el documento no mencione ' +
      'ningún mecanismo de reporting/medición/KPI/cálculo de ROI SÍ es evidencia real del ' +
      'riesgo — en ese caso marca un nivel alto, no "Bajo" por defecto. La regla de "sin ' +
      'evidencia, Bajo" aplica a riesgos sobre la PRESENCIA de algo malo, no a estos. ' +
      'Devuelve ÚNICAMENTE un objeto JSON con la forma ' +
      '{"results": [{"factorId": string, "level": "Alto"|"Medio"|"Bajo", "impact": "Alto"|"Medio"|"Bajo"}]}.';

    const result = (await askOpenAiForJson(system, JSON.stringify({ extractedData, factors }))) as {
      results?: RiskFactorResult[];
    };
    return result.results ?? [];
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
      'Devuelve ÚNICAMENTE un objeto JSON con la forma {"results": [{"activationCatalogItemId": ' +
      'string, "channelId": string|null, "objective": string|null, "description": string|null, ' +
      '"priority": "Alta"|"Media"|"Baja"}]}.';

    const result = (await askOpenAiForJson(system, JSON.stringify({ extractedData, catalogItems, channels }))) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results?: any[];
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
