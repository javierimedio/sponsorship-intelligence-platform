// src/application/use-cases/activation/update-activation-followup.ts
// Seguimiento post-ejecución: marcar el estado real de una acción y su resultado de KPI.
// Nunca borra/recrea — actualiza la fila, preservando el resto del plan intacto.

import { ActivationResultRepository } from '../../../domain/activation/repositories';
import { ActivationFollowUpInput } from '../../../domain/activation/types';

export interface UpdateActivationFollowUpInput {
  actionId: string;
  followUp: ActivationFollowUpInput;
}

export class UpdateActivationFollowUpUseCase {
  constructor(private readonly resultRepository: ActivationResultRepository) {}

  async execute(input: UpdateActivationFollowUpInput): Promise<void> {
    await this.resultRepository.updateFollowUp(input.actionId, input.followUp);
  }
}
