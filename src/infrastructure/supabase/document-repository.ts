// src/infrastructure/supabase/document-repository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { DocumentType, ProposalDocument } from '../../domain/intake/document';
import { DocumentRepository } from '../../domain/intake/repositories';
import {
  asDocumentId,
  asOrganizationId,
  asProposalId,
  asTenantId,
  asUserId,
  ProposalId,
} from '../../domain/shared/ids';

interface DocumentRow {
  id: string;
  tenant_id: string;
  organization_id: string;
  proposal_id: string;
  storage_path: string;
  document_type: DocumentType;
  original_filename: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

function toDomain(row: DocumentRow): ProposalDocument {
  return ProposalDocument.create({
    id: asDocumentId(row.id),
    tenantId: asTenantId(row.tenant_id),
    organizationId: asOrganizationId(row.organization_id),
    proposalId: asProposalId(row.proposal_id),
    storagePath: row.storage_path,
    documentType: row.document_type,
    originalFilename: row.original_filename,
    uploadedBy: row.uploaded_by ? asUserId(row.uploaded_by) : null,
    uploadedAt: new Date(row.uploaded_at),
  });
}

export class SupabaseDocumentRepository implements DocumentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllByProposal(proposalId: ProposalId): Promise<ProposalDocument[]> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async save(document: ProposalDocument): Promise<void> {
    const { error } = await this.client.from('documents').upsert({
      id: document.id,
      tenant_id: document.tenantId,
      organization_id: document.organizationId,
      proposal_id: document.proposalId,
      storage_path: document.storagePath,
      document_type: document.documentType,
      original_filename: document.originalFilename,
      uploaded_by: document.uploadedBy,
    });

    if (error) throw error;
  }
}
