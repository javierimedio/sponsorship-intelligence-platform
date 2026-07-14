// src/application/use-cases/intake/run-extraction-agent.ts

import { AIProvider } from '../../../domain/shared/ai-provider';
import { AiExtractionRepository, ProposalRepository } from '../../../domain/intake/repositories';
import { DocumentId, OrganizationId, ProposalId, TenantId } from '../../../domain/shared/ids';

export interface RunExtractionAgentInput {
  tenantId: TenantId;
  organizationId: OrganizationId;
  proposalId: ProposalId;
  documentId: DocumentId | null;
  files: { buffer: Buffer; mediaType: string }[];
  /** Nombre del proveedor realmente usado (ej. 'openai', 'anthropic', 'gemini') — antes
   *  quedaba fijo a 'claude-sonnet-5' aunque se usara otro proveedor, dato incorrecto en
   *  el Historial de cambios. */
  providerName: string;
}

export class RunExtractionAgentUseCase {
  constructor(
    private readonly extractionRepository: AiExtractionRepository,
    private readonly proposalRepository: ProposalRepository,
    private readonly aiProvider: AIProvider,
  ) {}

  async execute(input: RunExtractionAgentInput): Promise<Record<string, unknown>> {
    const extractedJson = await this.aiProvider.extractProposalData(input.files);

    await this.extractionRepository.save({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      documentId: input.documentId,
      modelUsed: input.providerName,
      extractedJson,
      status: 'completed',
    });

    const proposal = await this.proposalRepository.findById(input.proposalId);
    if (proposal) {
      const requesterOrg = typeof extractedJson.requester_org === 'string' ? extractedJson.requester_org : undefined;
      await this.proposalRepository.save(proposal.markExtracted(requesterOrg));
    }

    return extractedJson;
  }
}
