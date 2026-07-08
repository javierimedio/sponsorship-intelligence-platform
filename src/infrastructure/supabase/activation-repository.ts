// src/infrastructure/supabase/activation-repository.ts

import { randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  ActivationCatalogRepository,
  ActivationResultRepository,
} from '../../domain/activation/repositories';
import { ActivationCatalogItem } from '../../domain/activation/types';
import { OrganizationId, ProposalId } from '../../domain/shared/ids';

export class SupabaseActivationCatalogRepository implements ActivationCatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getCatalog(organizationId: OrganizationId): Promise<ActivationCatalogItem[]> {
    const { data, error } = await this.client
      .from('activation_catalog_items')
      .select('id, area, name')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data ?? [];
  }
}

export class SupabaseActivationResultRepository implements ActivationResultRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenantId: string,
    private readonly organizationId: string,
  ) {}

  async saveSelection(
    proposalId: ProposalId,
    activationCatalogItemIds: string[],
    notes: string,
    source: 'ai' | 'manual',
  ): Promise<void> {
    const { error: deleteError } = await this.client
      .from('proposal_activations')
      .delete()
      .eq('proposal_id', proposalId);
    if (deleteError) throw deleteError;

    if (!activationCatalogItemIds.length) return;

    const { error } = await this.client.from('proposal_activations').insert(
      activationCatalogItemIds.map((id) => ({
        id: randomUUID(),
        tenant_id: this.tenantId,
        organization_id: this.organizationId,
        proposal_id: proposalId,
        activation_catalog_item_id: id,
        notes,
        source,
      })),
    );
    if (error) throw error;
  }
}
