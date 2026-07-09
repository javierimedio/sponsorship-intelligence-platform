// src/lib/decision-quality.ts
// "Decision Confidence" mide la CALIDAD de la evaluación, nunca la IA — son 4 comprobaciones
// deterministas sobre datos que ya existen. Reutilizado por el Workspace, el Executive
// Report y (más adelante) Compare Mode, para que los tres cuenten siempre la misma historia.

export interface DecisionQualityInput {
  hasRecommendation: boolean;
  scoresCount: number;
  totalScoringAttributes: number;
  risksCount: number;
  totalRiskFactors: number;
  missingFieldsCount: number;
  totalTrackedFields: number;
  benchmarkSampleSize: number;
}

export interface DecisionQualityCheck {
  label: string;
  passed: boolean;
}

export type Readiness = 'ready' | 'partial' | 'not_evaluable';

export interface DecisionQuality {
  confidencePct: number;
  confidenceLabel: string;
  checks: DecisionQualityCheck[];
  completenessPct: number;
  readiness: Readiness;
}

export function computeDecisionQuality(input: DecisionQualityInput): DecisionQuality {
  const checks: DecisionQualityCheck[] = [
    {
      label: 'Evaluación completa',
      passed: input.totalScoringAttributes > 0 && input.scoresCount >= input.totalScoringAttributes,
    },
    { label: 'Sin datos faltantes', passed: input.missingFieldsCount === 0 },
    { label: 'Benchmark suficiente', passed: input.benchmarkSampleSize >= 5 },
    {
      label: 'Riesgos evaluados',
      passed: input.totalRiskFactors > 0 && input.risksCount >= input.totalRiskFactors,
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const confidencePct = Math.round((passedCount / checks.length) * 100);
  const confidenceLabel = confidencePct >= 75 ? 'Alta confianza' : confidencePct >= 50 ? 'Confianza media' : 'Confianza baja';

  const completenessPct =
    input.totalTrackedFields > 0
      ? Math.round(((input.totalTrackedFields - input.missingFieldsCount) / input.totalTrackedFields) * 100)
      : 100;

  let readiness: Readiness = 'not_evaluable';
  if (input.hasRecommendation) {
    readiness = input.missingFieldsCount === 0 ? 'ready' : 'partial';
  }

  return { confidencePct, confidenceLabel, checks, completenessPct, readiness };
}

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: '🟢 Lista para decisión',
  partial: '🟡 Faltan datos',
  not_evaluable: '🔴 No evaluable',
};
