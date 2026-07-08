// src/lib/workspace-stage.ts
// Deriva el estado del Workspace adaptativo (Documento 6, §5) a partir de datos que YA
// existen — no es un nuevo campo de estado, es una función de presentación pura sobre
// recommendation / approved_at / finalized_at.

export type WorkspaceStage = 'draft' | 'evaluated' | 'approved' | 'finalized';

export interface ProposalLifecycleFields {
  recommendation: string | null;
  approved_at: string | null;
  finalized_at: string | null;
}

export function getWorkspaceStage(proposal: ProposalLifecycleFields): WorkspaceStage {
  if (proposal.finalized_at) return 'finalized';
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
