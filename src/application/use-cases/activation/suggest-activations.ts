// src/application/use-cases/activation/suggest-activations.ts
// Agente 4 — Activación. Deliberadamente separado de EvaluateProposalUseCase: es un
// bounded context distinto (Activation, no Evaluation) y, sobre todo, tiene una regla de
// negocio propia que no comparten los otros agentes: SOLO actúa si la propuesta no tiene
// ninguna activación todavía. Si ya hay una (añadida a mano, o de una evaluación anterior),
// no se toca — reevaluar nunca debe destruir un plan de activación ya trabajado por una
// persona. Los otros agentes SÍ se recalculan siempre porque su propio resultado anterior
// se archiva en el historial de versiones; las activaciones no tienen ese mismo colchón.

import { AIProvider } from '../../../domain/shared/ai-provider';
import { ActivationCatalogRepository, ActivationResultRepository } from '../../../domain/activation/repositories';
import { OrganizationId, ProposalId } from '../../../domain/shared/ids';

export interface SuggestActivationsInput {
  organizationId: OrganizationId;
  proposalId: ProposalId;
  extractedData: Record<string, unknown>;
}

export class SuggestActivationsUseCase {
  constructor(
    private readonly catalogRepository: ActivationCatalogRepository,
    private readonly resultRepository: ActivationResultRepository,
    private readonly aiProvider: AIProvider,
  ) {}

  async execute(input: SuggestActivationsInput): Promise<number> {
    const existing = await this.resultRepository.listActions(input.proposalId);
    if (existing.length > 0) return 0; // ya hay un plan — no se toca, aunque sea de IA de una vez anterior

    const [catalogItems, channels] = await Promise.all([
      this.catalogRepository.getCatalogItems(input.organizationId),
      this.catalogRepository.getChannels(input.organizationId),
    ]);
    if (!catalogItems.length) return 0;

    const suggestions = await this.aiProvider.suggestActivations(
      input.extractedData,
      catalogItems.map((i) => ({ id: i.id, area: i.area, name: i.name })),
      channels.map((c) => ({ id: c.id, name: c.name })),
    );

    const validItemIds = new Set(catalogItems.map((i) => i.id));
    const validChannelIds = new Set(channels.map((c) => c.id));

    let created = 0;
    for (const s of suggestions) {
      if (!validItemIds.has(s.activationCatalogItemId)) continue; // nunca fuera de catálogo, ni si la IA se lo inventa
      await this.resultRepository.addAction(
        input.proposalId,
        {
          activationCatalogItemId: s.activationCatalogItemId,
          channelId: s.channelId && validChannelIds.has(s.channelId) ? s.channelId : null,
          objective: s.objective ?? null,
          description: s.description ?? null,
          priority: ['Alta', 'Media', 'Baja'].includes(s.priority) ? s.priority : null,
          expectedImpact: null,
          effort: null,
          responsible: null,
          startDate: null,
          endDate: null,
          kpiDefinitionId: null,
          kpiName: null,
          kpiTarget: null,
          isReusable: null,
          usefulLife: null,
        },
        'ai',
      );
      created += 1;
    }
    return created;
  }
}
