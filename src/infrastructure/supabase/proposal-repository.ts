// src/infrastructure/supabase/proposal-repository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { Proposal, ProposalStatus } from '../../domain/intake/proposal';
import { ProposalRepository } from '../../domain/intake/repositories';
import {
  asOrganizationId,
  asProposalId,
  asTenantId,
  asUserId,
  OrganizationId,
  ProposalId,
} from '../../domain/shared/ids';

interface ProposalRow {
  id: string;
  tenant_id: string;
  organization_id: string;
  title: string;
  status: ProposalStatus;
  created_by: string | null;
  created_at: string;
}

function toDomain(row: ProposalRow): Proposal {
  return Proposal.fromPersistence({
    id: asProposalId(row.id),
    tenantId: asTenantId(row.tenant_id),
    organizationId: asOrganizationId(row.organization_id),
    title: row.title,
    status: row.status,
    createdBy: row.created_by ? asUserId(row.created_by) : null,
    createdAt: new Date(row.created_at),
  });
}

export class SupabaseProposalRepository implements ProposalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: ProposalId): Promise<Proposal | null> {
    const { data, error } = await this.client
      .from('proposals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findAllByOrganization(organizationId: OrganizationId): Promise<Proposal[]> {
    const { data, error } = await this.client
      .from('proposals')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async save(proposal: Proposal): Promise<void> {
    const { error } = await this.client.from('proposals').upsert({
      id: proposal.id,
      tenant_id: proposal.tenantId,
      organization_id: proposal.organizationId,
      title: proposal.title,
      status: proposal.status,
      created_by: proposal.createdBy,
    });

    if (error) throw error;
  }
}
