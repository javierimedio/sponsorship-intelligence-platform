// src/domain/intake/document.ts

import { DocumentId, OrganizationId, ProposalId, TenantId, UserId } from '../shared/ids';

export type DocumentType = 'original' | 'email' | 'ai_generated' | 'image' | 'dossier' | 'other';

export class ProposalDocument {
  private constructor(
    public readonly id: DocumentId,
    public readonly tenantId: TenantId,
    public readonly organizationId: OrganizationId,
    public readonly proposalId: ProposalId,
    public readonly storagePath: string,
    public readonly documentType: DocumentType,
    public readonly originalFilename: string | null,
    public readonly uploadedBy: UserId | null,
    public readonly uploadedAt: Date,
  ) {}

  static create(params: {
    id: DocumentId;
    tenantId: TenantId;
    organizationId: OrganizationId;
    proposalId: ProposalId;
    storagePath: string;
    documentType?: DocumentType;
    originalFilename?: string | null;
    uploadedBy: UserId | null;
    uploadedAt: Date;
  }): ProposalDocument {
    if (!params.storagePath.trim()) {
      throw new Error('La ruta de almacenamiento del documento no puede estar vacía.');
    }
    return new ProposalDocument(
      params.id,
      params.tenantId,
      params.organizationId,
      params.proposalId,
      params.storagePath,
      params.documentType ?? 'other',
      params.originalFilename ?? null,
      params.uploadedBy,
      params.uploadedAt,
    );
  }
}
