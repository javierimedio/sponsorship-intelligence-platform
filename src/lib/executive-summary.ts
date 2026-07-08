// src/lib/executive-summary.ts
// Desacoplado a propósito: el Workspace solo conoce esta firma de función, nunca su
// implementación. Sustituir generateExecutiveSummary por un AIExecutiveSummaryProvider
// real (llamada a Claude/Gemini/OpenAI) el día de mañana es cambiar ESTE archivo,
// nunca el componente visual que lo consume.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
}

/** Contrato que cualquier generador de Executive Summary debe cumplir — determinista hoy,
 *  respaldado por IA mañana, sin que el componente visual se entere del cambio. */
export type ExecutiveSummaryProvider = (input: ExecutiveSummaryInput) => Promise<string[]> | string[];

export const generateExecutiveSummary: ExecutiveSummaryProvider = (input) => {
  const { proposal, scores, risks, pendingActivations } = input;

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
