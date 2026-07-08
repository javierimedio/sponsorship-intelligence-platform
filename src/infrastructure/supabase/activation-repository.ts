// src/infrastructure/supabase/activation-repository.ts

import { randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  ActivationCatalogRepository,
  ActivationResultRepository,
} from '../../domain/activation/repositories';
import {
  ActivationAction,
  ActivationActionInput,
  ActivationCatalogItem,
  ActivationFollowUpInput,
  ChannelItem,
  KpiDefinitionItem,
} from '../../domain/activation/types';
import { OrganizationId, ProposalId } from '../../domain/shared/ids';

export class SupabaseActivationCatalogRepository implements ActivationCatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getCatalogItems(organizationId: OrganizationId): Promise<ActivationCatalogItem[]> {
    const { data, error } = await this.client
      .from('activation_catalog_items')
      .select('id, area, name')
      .eq('organization_id', organizationId)
      .order('area');
    if (error) throw error;
    return data ?? [];
  }

  async getChannels(organizationId: OrganizationId): Promise<ChannelItem[]> {
    const { data, error } = await this.client
      .from('channels')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');
    if (error) throw error;
    return data ?? [];
  }

  async getKpiDefinitions(organizationId: OrganizationId): Promise<KpiDefinitionItem[]> {
    const { data, error } = await this.client
      .from('kpi_definitions')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');
    if (error) throw error;
    return data ?? [];
  }
}

interface ActionRow {
  id: string;
  activation_catalog_item_id: string;
  channel_id: string | null;
  objective: string | null;
  description: string | null;
  priority: string | null;
  expected_impact: string | null;
  effort: string | null;
  responsible: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  kpi_definition_id: string | null;
  kpi_target: string | null;
  kpi_result: string | null;
  is_reusable: boolean | null;
  useful_life: string | null;
  source: 'ai' | 'manual';
  activation_catalog_items?: { area: string; name: string } | null;
  channels?: { name: string } | null;
  kpi_definitions?: { name: string } | null;
}

function toDomain(row: ActionRow): ActivationAction {
  return {
    id: row.id,
    activationCatalogItemId: row.activation_catalog_item_id,
    channelId: row.channel_id,
    objective: row.objective,
    description: row.description,
    priority: row.priority,
    expectedImpact: row.expected_impact,
    effort: row.effort,
    responsible: row.responsible,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    kpiDefinitionId: row.kpi_definition_id,
    kpiTarget: row.kpi_target,
    kpiResult: row.kpi_result,
    isReusable: row.is_reusable,
    usefulLife: row.useful_life,
    source: row.source,
    activationCatalogItemArea: row.activation_catalog_items?.area,
    activationCatalogItemName: row.activation_catalog_items?.name,
    channelName: row.channels?.name ?? null,
    kpiDefinitionName: row.kpi_definitions?.name ?? null,
  };
}

const SELECT_WITH_JOINS =
  'id, activation_catalog_item_id, channel_id, objective, description, priority, expected_impact, ' +
  'effort, responsible, start_date, end_date, status, kpi_definition_id, kpi_target, kpi_result, ' +
  'is_reusable, useful_life, source, ' +
  'activation_catalog_items(area, name), channels(name), kpi_definitions(name)';

export class SupabaseActivationResultRepository implements ActivationResultRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenantId: string,
    private readonly organizationId: string,
  ) {}

  async addAction(
    proposalId: ProposalId,
    input: ActivationActionInput,
    source: 'ai' | 'manual',
  ): Promise<ActivationAction> {
    const id = randomUUID();
    const { error } = await this.client.from('proposal_activations').insert({
      id,
      tenant_id: this.tenantId,
      organization_id: this.organizationId,
      proposal_id: proposalId,
      activation_catalog_item_id: input.activationCatalogItemId,
      channel_id: input.channelId,
      objective: input.objective,
      description: input.description,
      priority: input.priority,
      expected_impact: input.expectedImpact,
      effort: input.effort,
      responsible: input.responsible,
      start_date: input.startDate,
      end_date: input.endDate,
      kpi_definition_id: input.kpiDefinitionId,
      kpi_target: input.kpiTarget,
      is_reusable: input.isReusable,
      useful_life: input.usefulLife,
      source,
    });
    if (error) throw error;

    const { data, error: fetchError } = await this.client
      .from('proposal_activations')
      .select(SELECT_WITH_JOINS)
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;
    return toDomain(data as unknown as ActionRow);
  }

  async listActions(proposalId: ProposalId): Promise<ActivationAction[]> {
    const { data, error } = await this.client
      .from('proposal_activations')
      .select(SELECT_WITH_JOINS)
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as unknown as ActionRow[] | null ?? []).map(toDomain);
  }

  async updateFollowUp(actionId: string, input: ActivationFollowUpInput): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.kpiResult !== undefined) updates.kpi_result = input.kpiResult;
    if (!Object.keys(updates).length) return;

    const { error } = await this.client.from('proposal_activations').update(updates).eq('id', actionId);
    if (error) throw error;
  }

  async deleteAction(actionId: string): Promise<void> {
    const { error } = await this.client.from('proposal_activations').delete().eq('id', actionId);
    if (error) throw error;
  }
}
