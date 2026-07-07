// src/application/use-cases/intake/create-proposal.ts

import { randomUUID } from 'crypto';
import { Proposal } from '../../../domain/intake/proposal';
import { ProposalRepository } from '../../../domain/intake/repositories';
import {
  asProposalId,
  OrganizationId,
  TenantId,
  UserId,
} from '../../../domain/shared/ids';

export interface CreateProposalInput {
  tenantId: TenantId;
  organizationId: OrganizationId;
  title: string;
  createdBy: UserId | null;
}

export class CreateProposalUseCase {
  constructor(private readonly proposalRepository: ProposalRepository) {}

  async execute(input: CreateProposalInput): Promise<Proposal> {
    const proposal = Proposal.create({
      id: asProposalId(randomUUID()),
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      title: input.title,
      createdBy: input.createdBy,
      createdAt: new Date(),
    });

    await this.proposalRepository.save(proposal);
    return proposal;
  }
}
