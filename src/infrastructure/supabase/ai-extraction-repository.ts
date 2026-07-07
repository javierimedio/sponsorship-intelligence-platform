// src/infrastructure/supabase/ai-extraction-repository.ts

import { randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { AiExtractionRepository } from '../../domain/intake/repositories';
import { ProposalId } from '../../domain/shared/ids';

export class SupabaseAiExtractionRepository implements AiExtractionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(params: Parameters<AiExtractionRepository['save']>[0]): Promise<void> {
    const { error } = await this.client.from('ai_extractions').insert({
      id: randomUUID(),
      tenant_id: params.tenantId,
      organization_id: params.organizationId,
      proposal_id: params.proposalId,
      document_id: params.documentId,
      model_used: params.modelUsed,
      extracted_json: params.extractedJson,
      status: params.status,
    });

    if (error) throw error;
  }

  async findLatestExtractedJson(proposalId: ProposalId): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('ai_extractions')
      .select('extracted_json')
      .eq('proposal_id', proposalId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.extracted_json as Record<string, unknown> | undefined) ?? null;
  }
}
