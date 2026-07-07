// src/domain/evaluation/repositories.ts

import { EvaluationCatalog, EvaluationOutcome } from './types';
import { OrganizationId, ProposalId } from '../shared/ids';

export interface EvaluationCatalogRepository {
  getCatalog(organizationId: OrganizationId): Promise<EvaluationCatalog>;
}

export interface EvaluationResultRepository {
  saveOutcome(proposalId: ProposalId, outcome: EvaluationOutcome): Promise<void>;
}
