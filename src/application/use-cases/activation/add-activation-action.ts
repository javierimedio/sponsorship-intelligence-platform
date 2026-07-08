// src/application/use-cases/activation/add-activation-action.ts

import { ActivationResultRepository } from '../../../domain/activation/repositories';
import { ActivationAction, ActivationActionInput } from '../../../domain/activation/types';
import { ProposalId } from '../../../domain/shared/ids';

export interface AddActivationActionInput {
  proposalId: ProposalId;
  action: ActivationActionInput;
}

export class AddActivationActionUseCase {
  constructor(private readonly resultRepository: ActivationResultRepository) {}

  async execute(input: AddActivationActionInput): Promise<ActivationAction> {
    return this.resultRepository.addAction(input.proposalId, input.action, 'manual');
  }
}
