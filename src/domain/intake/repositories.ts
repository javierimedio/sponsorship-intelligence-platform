// src/domain/intake/repositories.ts

import { ProposalDocument } from './document';
import { Proposal } from './proposal';
import { OrganizationId, ProposalId } from '../shared/ids';

export interface ProposalRepository {
  findById(id: ProposalId): Promise<Proposal | null>;
  findAllByOrganization(organizationId: OrganizationId): Promise<Proposal[]>;
  save(proposal: Proposal): Promise<void>;
}

export interface DocumentRepository {
  findAllByProposal(proposalId: ProposalId): Promise<ProposalDocument[]>;
  save(document: ProposalDocument): Promise<void>;
}
