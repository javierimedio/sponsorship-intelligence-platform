// src/application/use-cases/evaluation/build-evaluation-outcome.ts
// Lógica determinista de agregación — idéntica se rellenen los datos por un Agente de IA
// o por un humano en un formulario. Esto es intencional: el motor de scoring/riesgo/
// recomendación no debe saber ni importarle de dónde vinieron los números de entrada.

import { EvaluationCatalog, EvaluationOutcome } from '../../../domain/evaluation/types';
import {
  EconomicConceptResult,
  RiskFactorResult,
  ScoringAttributeResult,
} from '../../../domain/shared/ai-provider';

export function computeRecommendation(totalScore: number, overallRiskLevel: string): string {
  if (overallRiskLevel === 'Alto' && totalScore < 0.7) return 'No recomendable';
  if (totalScore >= 0.7 && overallRiskLevel !== 'Alto') return 'Recomendable';
  if (totalScore >= 0.4) return 'Táctico';
  return 'No recomendable';
}

export function buildEvaluationOutcome(
  catalog: EvaluationCatalog,
  scoreResults: ScoringAttributeResult[],
  riskResults: RiskFactorResult[],
  financialResults: EconomicConceptResult[],
): EvaluationOutcome {
  const totalScore = scoreResults.reduce((sum, r) => sum + r.score, 0);

  const risks = riskResults.map((r) => {
    const rule = catalog.riskMatrixRules.find((m) => m.level === r.level && m.impact === r.impact);
    return { factorId: r.factorId, level: r.level, impact: r.impact, computedScore: rule?.score ?? 0 };
  });

  const worstRiskScore = risks.reduce((max, r) => Math.max(max, r.computedScore), 0);
  const overallRiskLevel = worstRiskScore >= 7 ? 'Alto' : worstRiskScore >= 4 ? 'Medio' : 'Bajo';

  return {
    totalScore,
    overallRiskLevel,
    recommendation: computeRecommendation(totalScore, overallRiskLevel),
    scores: scoreResults.map((r) => ({
      attributeId: r.attributeId,
      scoreValue: r.score,
      rationale: r.rationale,
    })),
    risks,
    financials: financialResults.map((r) => ({
      conceptId: r.conceptId,
      estimatedAmount: r.estimatedAmount,
    })),
  };
}
