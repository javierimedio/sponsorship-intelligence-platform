// src/application/use-cases/intake/register-document.ts
// Se ejecuta DESPUÉS de que el archivo ya está físicamente en Supabase Storage
// (subida directa desde el cliente vía signed URL / RLS de storage.objects).
// Este caso de uso solo registra los metadatos — nunca toca el archivo en sí.

import { randomUUID } from 'crypto';
import { DocumentType, ProposalDocument } from '../../../domain/intake/document';
import { DocumentRepository } from '../../../domain/intake/repositories';
import {
  asDocumentId,
  OrganizationId,
  ProposalId,
  TenantId,
  UserId,
} from '../../../domain/shared/ids';

export interface RegisterDocumentInput {
  tenantId: TenantId;
  organizationId: OrganizationId;
  proposalId: ProposalId;
  storagePath: string;
  documentType?: DocumentType;
  originalFilename?: string;
  uploadedBy: UserId | null;
}

export class RegisterDocumentUseCase {
  constructor(private readonly documentRepository: DocumentRepository) {}

  async execute(input: RegisterDocumentInput): Promise<ProposalDocument> {
    const document = ProposalDocument.create({
      id: asDocumentId(randomUUID()),
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      storagePath: input.storagePath,
      documentType: input.documentType,
      originalFilename: input.originalFilename,
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date(),
    });

    await this.documentRepository.save(document);
    return document;
  }
}
