// src/domain/activation/repositories.ts

import { ActivationCatalogItem } from './types';
import { OrganizationId, ProposalId } from '../shared/ids';

export interface ActivationCatalogRepository {
  getCatalog(organizationId: OrganizationId): Promise<ActivationCatalogItem[]>;
}

export interface ActivationResultRepository {
  /** Sustituye la selección anterior de esta propuesta por la nueva (no hace diffs). */
  saveSelection(
    proposalId: ProposalId,
    activationCatalogItemIds: string[],
    notes: string,
    source: 'ai' | 'manual',
  ): Promise<void>;
}
