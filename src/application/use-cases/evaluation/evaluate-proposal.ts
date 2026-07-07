// src/application/use-cases/evaluation/evaluate-proposal.ts
// Orquesta los Agentes 2 (Evaluation), 3 (Risk) y 5 (ROI/Financials) en paralelo,
// y calcula una recomendación DETERMINISTA a partir de sus resultados — nunca es la IA
// quien "opina" la recomendación final, exactamente como se decidió en el Documento 3
// (Parte G): es lo que permite a un CEO/Finanzas auditar por qué el sistema dice lo que dice.
//
// MVP: el umbral de recomendación está fijo en código. El Rule Engine configurable
// (tablas `recommendation_rule_sets`/`recommendation_rules` del Documento 4) es la
// evolución natural de esta función cuando el negocio necesite cambiar la política
// sin tocar código.

import { AIProvider } from '../../../domain/shared/ai-provider';
import {
  EvaluationCatalogRepository,
  EvaluationResultRepository,
} from '../../../domain/evaluation/repositories';
import { EvaluationOutcome } from '../../../domain/evaluation/types';
import { OrganizationId, ProposalId } from '../../../domain/shared/ids';

export interface EvaluateProposalInput {
  organizationId: OrganizationId;
  proposalId: ProposalId;
  extractedData: Record<string, unknown>;
}

function computeRecommendation(totalScore: number, overallRiskLevel: string): string {
  if (overallRiskLevel === 'Alto' && totalScore < 0.7) return 'No recomendable';
  if (totalScore >= 0.7 && overallRiskLevel !== 'Alto') return 'Recomendable';
  if (totalScore >= 0.4) return 'Táctico';
  return 'No recomendable';
}

export class EvaluateProposalUseCase {
  constructor(
    private readonly catalogRepository: EvaluationCatalogRepository,
    private readonly resultRepository: EvaluationResultRepository,
    private readonly aiProvider: AIProvider,
  ) {}

  async execute(input: EvaluateProposalInput): Promise<EvaluationOutcome> {
    const catalog = await this.catalogRepository.getCatalog(input.organizationId);

    // Agentes 2, 3 y 5 son independientes entre sí — se ejecutan en paralelo,
    // tal como se diseñó en el Documento 3 (Parte C.1).
    const [scoreResults, riskResults, financialResults] = await Promise.all([
      this.aiProvider.scoreAttributes(
        input.extractedData,
        catalog.scoringAttributes.map((a) => ({ id: a.id, name: a.name, maxScore: a.maxScore })),
      ),
      this.aiProvider.evaluateRiskFactors(
        input.extractedData,
        catalog.riskFactors.map((f) => ({ id: f.id, name: f.name })),
      ),
      this.aiProvider.extractFinancialLines(
        input.extractedData,
        catalog.economicConcepts.map((c) => ({ id: c.id, name: c.name, nature: c.nature })),
      ),
    ]);

    const totalScore = scoreResults.reduce((sum, r) => sum + r.score, 0);

    const risks = riskResults.map((r) => {
      const rule = catalog.riskMatrixRules.find((m) => m.level === r.level && m.impact === r.impact);
      return { factorId: r.factorId, level: r.level, impact: r.impact, computedScore: rule?.score ?? 0 };
    });

    const worstRiskScore = risks.reduce((max, r) => Math.max(max, r.computedScore), 0);
    const overallRiskLevel = worstRiskScore >= 7 ? 'Alto' : worstRiskScore >= 4 ? 'Medio' : 'Bajo';

    const outcome: EvaluationOutcome = {
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

    await this.resultRepository.saveOutcome(input.proposalId, outcome);
    return outcome;
  }
}
