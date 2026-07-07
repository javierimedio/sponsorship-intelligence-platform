// src/domain/intake/repositories.ts

import { ProposalDocument } from './document';
import { Proposal } from './proposal';
import { DocumentId, OrganizationId, ProposalId, TenantId } from '../shared/ids';

export interface ProposalRepository {
  findById(id: ProposalId): Promise<Proposal | null>;
  findAllByOrganization(organizationId: OrganizationId): Promise<Proposal[]>;
  save(proposal: Proposal): Promise<void>;
}

export interface DocumentRepository {
  findAllByProposal(proposalId: ProposalId): Promise<ProposalDocument[]>;
  save(document: ProposalDocument): Promise<void>;
}

export type AiExtractionStatus = 'pending' | 'completed' | 'needs_review' | 'failed';

export interface AiExtractionRepository {
  save(params: {
    tenantId: TenantId;
    organizationId: OrganizationId;
    proposalId: ProposalId;
    documentId: DocumentId | null;
    modelUsed: string;
    extractedJson: Record<string, unknown>;
    status: AiExtractionStatus;
  }): Promise<void>;

  /** Última extracción completada de la propuesta, o null si no hay ninguna. */
  findLatestExtractedJson(proposalId: ProposalId): Promise<Record<string, unknown> | null>;
}
