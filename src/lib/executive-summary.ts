// src/lib/executive-summary.ts
// Desacoplado a propósito: el Workspace solo conoce esta firma de función, nunca su
// implementación. Sustituir generateExecutiveSummary por un AIExecutiveSummaryProvider
// real (llamada a Claude/Gemini/OpenAI) el día de mañana es cambiar ESTE archivo,
// nunca el componente visual que lo consume.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface BrandAiContext {
  brandName: string;
  positioning: string | null;
  evaluationFocus: string[] | null;
  recommendedActivations: string | null;
  negotiationGuidelines: string | null;
}

export interface ExecutiveSummaryInput {
  proposal: {
    total_score: number | null;
    recommendation: string | null;
    overall_risk_level: string | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scores: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  risks: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingActivations: any[];
  /** Contexto de marca — SOLO para interpretar y redactar. Nunca llega a las llamadas
   *  que producen score_value/level/impact/estimated_amount; esas siguen siendo idénticas
   *  para cualquier marca. */
  brandContext?: BrandAiContext | null;
}

/** Contrato que cualquier generador de Executive Summary debe cumplir — determinista hoy,
 *  respaldado por IA mañana, sin que el componente visual se entere del cambio. */
export type ExecutiveSummaryProvider = (input: ExecutiveSummaryInput) => Promise<string[]> | string[];

export const generateExecutiveSummary: ExecutiveSummaryProvider = (input) => {
  const { proposal, scores, risks, pendingActivations, brandContext } = input;

  if (proposal.total_score === null) {
    return ['Esta propuesta todavía no ha sido evaluada — no hay nada que interpretar todavía.'];
  }

  const paragraphs: string[] = [];
  const pct = Math.round(proposal.total_score * 100);
  paragraphs.push(
    `Esta propuesta obtiene un score del ${pct}% y una recomendación de "${proposal.recommendation}", con un riesgo global ${proposal.overall_risk_level ?? 'sin calcular'}.`,
  );

  const topScores = [...scores].sort((a, b) => Number(b.score_value) - Number(a.score_value)).slice(0, 2);
  if (topScores.length) {
    paragraphs.push(
      `Los principales motivos son: ${topScores
        .map((s) => `${s.scoring_attributes?.name} (${Number(s.score_value).toFixed(2)}/${s.scoring_attributes?.max_score})`)
        .join(', ')}.`,
    );
  }

  const relevantRisks = risks.filter((r) => r.level === 'Alto' || r.impact === 'Alto');
  paragraphs.push(
    relevantRisks.length
      ? `He detectado ${relevantRisks.length} riesgo(s) relevante(s): ${relevantRisks.map((r) => r.risk_factors?.name).join(', ')}.`
      : 'No he detectado riesgos de nivel alto en esta propuesta.',
  );

  if (pendingActivations.length) {
    const highPriority = pendingActivations.filter((a) => a.priority === 'Alta');
    const list = (highPriority.length ? highPriority : pendingActivations).slice(0, 2);
    paragraphs.push(`Las acciones que más incrementarían el ROI serían: ${list.map((a) => a.activation_catalog_items?.name).join(', ')}.`);
  }

  // Contexto de marca — solo interpretación, añadido al final, nunca toca el cálculo de arriba.
  if (brandContext?.evaluationFocus?.length) {
    const scoredAttributeNames = scores.map((s) => String(s.scoring_attributes?.name ?? '').toLowerCase());
    const matchingFocus = brandContext.evaluationFocus.filter((focus) =>
      scoredAttributeNames.some((name) => name.includes(focus.toLowerCase()) || focus.toLowerCase().includes(name)),
    );
    if (matchingFocus.length) {
      paragraphs.push(
        `Para ${brandContext.brandName}, esta propuesta conecta especialmente con: ${matchingFocus.join(', ')} — criterios que esta marca prioriza especialmente.`,
      );
    } else {
      paragraphs.push(
        `Para ${brandContext.brandName}, ninguno de los atributos con mayor puntuación coincide directamente con sus prioridades habituales (${brandContext.evaluationFocus.slice(0, 3).join(', ')}...) — merece revisarse si encaja estratégicamente aunque el score sea bueno.`,
      );
    }
  }

  return paragraphs;
};

/** Fortalezas/debilidades para el bloque de Evaluación — mismo principio de desacoplo. */
export function generateStrengthsAndWeaknesses(scores: ExecutiveSummaryInput['scores']): { strengths: string[]; weaknesses: string[] } {
  const ranked = [...scores]
    .map((s) => ({
      label: `${s.scoring_attributes?.scoring_blocks?.name} — ${s.scoring_attributes?.name}`,
      ratio: Number(s.scoring_attributes?.max_score) > 0 ? Number(s.score_value) / Number(s.scoring_attributes.max_score) : 0,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  const strengths = ranked.filter((r) => r.ratio >= 0.7).slice(0, 3).map((r) => r.label);
  const weaknesses = ranked
    .filter((r) => r.ratio < 0.5)
    .slice(-3)
    .map((r) => r.label);

  return { strengths, weaknesses };
}
