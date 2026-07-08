// src/application/use-cases/intake/run-extraction-agent.ts

import { AIProvider } from '../../../domain/shared/ai-provider';
import { AiExtractionRepository, ProposalRepository } from '../../../domain/intake/repositories';
import { DocumentId, OrganizationId, ProposalId, TenantId } from '../../../domain/shared/ids';

export interface RunExtractionAgentInput {
  tenantId: TenantId;
  organizationId: OrganizationId;
  proposalId: ProposalId;
  documentId: DocumentId | null;
  fileBuffer: Buffer;
  mediaType: string;
}

// Fijo por ahora — cuando conectemos el catálogo `ai_agents` del Documento 3,
// esto se sustituye por una fila configurable en base de datos.
const MODEL_USED = 'claude-sonnet-5';

export class RunExtractionAgentUseCase {
  constructor(
    private readonly extractionRepository: AiExtractionRepository,
    private readonly proposalRepository: ProposalRepository,
    private readonly aiProvider: AIProvider,
  ) {}

  async execute(input: RunExtractionAgentInput): Promise<Record<string, unknown>> {
    const extractedJson = await this.aiProvider.extractProposalData(input.fileBuffer, input.mediaType);

    await this.extractionRepository.save({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      documentId: input.documentId,
      modelUsed: MODEL_USED,
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
