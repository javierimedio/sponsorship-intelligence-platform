// src/application/use-cases/intake/save-manual-extraction.ts

import { AiExtractionRepository, ProposalRepository } from '../../../domain/intake/repositories';
import { DocumentId, OrganizationId, ProposalId, TenantId } from '../../../domain/shared/ids';

export interface SaveManualExtractionInput {
  tenantId: TenantId;
  organizationId: OrganizationId;
  proposalId: ProposalId;
  documentId: DocumentId | null;
  extractedJson: Record<string, unknown>;
}

export class SaveManualExtractionUseCase {
  constructor(
    private readonly extractionRepository: AiExtractionRepository,
    private readonly proposalRepository: ProposalRepository,
  ) {}

  async execute(input: SaveManualExtractionInput): Promise<void> {
    await this.extractionRepository.save({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      documentId: input.documentId,
      modelUsed: 'manual-entry',
      extractedJson: input.extractedJson,
      status: 'completed',
    });

    const proposal = await this.proposalRepository.findById(input.proposalId);
    if (proposal) {
      const requesterOrg =
        typeof input.extractedJson.requester_org === 'string' ? input.extractedJson.requester_org : undefined;
      await this.proposalRepository.save(proposal.markExtracted(requesterOrg));
    }
  }
}
