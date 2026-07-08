// src/application/use-cases/activation/select-activations-manually.ts

import { ActivationResultRepository } from '../../../domain/activation/repositories';
import { ProposalId } from '../../../domain/shared/ids';

export interface SelectActivationsManuallyInput {
  proposalId: ProposalId;
  activationCatalogItemIds: string[];
  notes: string;
}

export class SelectActivationsManuallyUseCase {
  constructor(private readonly resultRepository: ActivationResultRepository) {}

  async execute(input: SelectActivationsManuallyInput): Promise<void> {
    await this.resultRepository.saveSelection(
      input.proposalId,
      input.activationCatalogItemIds,
      input.notes,
      'manual',
    );
  }
}
