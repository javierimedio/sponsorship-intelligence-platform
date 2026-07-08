// src/lib/workspace-stage.ts
// Deriva el estado del Workspace a partir de datos que YA existen — sigue siendo una
// función de presentación pura, ahora con 5 estados (se añade 'rejected').

export type WorkspaceStage = 'draft' | 'evaluated' | 'rejected' | 'approved' | 'finalized';

export interface ProposalLifecycleFields {
  recommendation: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  finalized_at: string | null;
}

export function getWorkspaceStage(proposal: ProposalLifecycleFields): WorkspaceStage {
  if (proposal.finalized_at) return 'finalized';
  if (proposal.rejected_at) return 'rejected';
  if (proposal.approved_at) return 'approved';
  if (proposal.recommendation) return 'evaluated';
  return 'draft';
}

export type Tone = 'positive' | 'warning' | 'negative' | 'neutral';

/** Tono de color para ConfidenceRing / DecisionStrip — combina score y riesgo, no solo el estado. */
export function getTone(params: { totalScore: number | null; overallRiskLevel: string | null }): Tone {
  if (params.totalScore === null) return 'neutral';
  if (params.overallRiskLevel === 'Alto' && params.totalScore < 0.7) return 'negative';
  if (params.totalScore >= 0.7 && params.overallRiskLevel !== 'Alto') return 'positive';
  if (params.totalScore >= 0.4) return 'warning';
  return 'negative';
}

/** Score de riesgo global /100 — media de los computed_score de la matriz de riesgo
 *  (escala 1-9 de risk_matrix_rules), reescalada. Es un derivado transparente de datos
 *  que ya existen, no un cálculo nuevo del motor. */
export function computeGlobalRiskScore(computedScores: number[]): number | null {
  if (!computedScores.length) return null;
  const avg = computedScores.reduce((a, b) => a + b, 0) / computedScores.length;
  return Math.round((avg / 9) * 100);
}
