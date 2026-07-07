// src/application/use-cases/evaluation/evaluate-proposal.ts
// Camino con IA: orquesta los Agentes 2 (Evaluation), 3 (Risk) y 5 (ROI/Financials)
// en paralelo, y delega el cálculo determinista a buildEvaluationOutcome — la misma
// función que usa el camino manual (evaluate-proposal-manually.ts).

import { AIProvider } from '../../../domain/shared/ai-provider';
import {
  EvaluationCatalogRepository,
  EvaluationResultRepository,
} from '../../../domain/evaluation/repositories';
import { EvaluationOutcome } from '../../../domain/evaluation/types';
import { OrganizationId, ProposalId } from '../../../domain/shared/ids';
import { buildEvaluationOutcome } from './build-evaluation-outcome';

export interface EvaluateProposalInput {
  organizationId: OrganizationId;
  proposalId: ProposalId;
  extractedData: Record<string, unknown>;
}

export class EvaluateProposalUseCase {
  constructor(
    private readonly catalogRepository: EvaluationCatalogRepository,
    private readonly resultRepository: EvaluationResultRepository,
    private readonly aiProvider: AIProvider,
  ) {}

  async execute(input: EvaluateProposalInput): Promise<EvaluationOutcome> {
    const catalog = await this.catalogRepository.getCatalog(input.organizationId);

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

    const outcome = buildEvaluationOutcome(catalog, scoreResults, riskResults, financialResults);
    await this.resultRepository.saveOutcome(input.proposalId, outcome, 'ai');
    return outcome;
  }
}
