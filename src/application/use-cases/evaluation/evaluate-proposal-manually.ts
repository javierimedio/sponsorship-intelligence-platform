// src/application/use-cases/evaluation/evaluate-proposal-manually.ts
// Camino sin IA: los mismos datos que rellenaría un Agente (score por atributo,
// nivel/impacto por factor de riesgo, importe por concepto económico) los introduce
// una persona en un formulario. El cálculo de agregado/recomendación es EXACTAMENTE
// el mismo que en el camino con IA (buildEvaluationOutcome) — la única diferencia real
// es de dónde vienen los números de entrada, y eso queda registrado como source='manual'.

import {
  EvaluationCatalogRepository,
  EvaluationResultRepository,
} from '../../../domain/evaluation/repositories';
import { EvaluationOutcome } from '../../../domain/evaluation/types';
import {
  EconomicConceptResult,
  RiskFactorResult,
  ScoringAttributeResult,
} from '../../../domain/shared/ai-provider';
import { OrganizationId, ProposalId } from '../../../domain/shared/ids';
import { buildEvaluationOutcome } from './build-evaluation-outcome';

export interface EvaluateProposalManuallyInput {
  organizationId: OrganizationId;
  proposalId: ProposalId;
  scores: ScoringAttributeResult[];
  risks: RiskFactorResult[];
  financials: EconomicConceptResult[];
}

export class EvaluateProposalManuallyUseCase {
  constructor(
    private readonly catalogRepository: EvaluationCatalogRepository,
    private readonly resultRepository: EvaluationResultRepository,
  ) {}

  async execute(input: EvaluateProposalManuallyInput): Promise<EvaluationOutcome> {
    const catalog = await this.catalogRepository.getCatalog(input.organizationId);
    const outcome = buildEvaluationOutcome(catalog, input.scores, input.risks, input.financials);
    await this.resultRepository.saveOutcome(input.proposalId, outcome, 'manual');
    return outcome;
  }
}
