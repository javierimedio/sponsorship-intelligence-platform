// src/domain/intake/proposal.ts

import { BrandId, OrganizationId, ProposalId, TenantId, UserId } from '../shared/ids';

export type ProposalStatus = 'received' | 'extracting' | 'extracted' | 'evaluated';

export class Proposal {
  private constructor(
    public readonly id: ProposalId,
    public readonly tenantId: TenantId,
    public readonly organizationId: OrganizationId,
    public readonly brandId: BrandId | null,
    public readonly title: string,
    public readonly status: ProposalStatus,
    public readonly createdBy: UserId | null,
    public readonly createdAt: Date,
    public readonly submittedAt: Date | null,
  ) {}

  static create(params: {
    id: ProposalId;
    tenantId: TenantId;
    organizationId: OrganizationId;
    brandId?: BrandId | null;
    title: string;
    createdBy: UserId | null;
    createdAt: Date;
  }): Proposal {
    if (!params.title.trim()) {
      throw new Error('El título de la propuesta no puede estar vacío.');
    }
    return new Proposal(
      params.id,
      params.tenantId,
      params.organizationId,
      params.brandId ?? null,
      params.title,
      'received',
      params.createdBy,
      params.createdAt,
      null,
    );
  }

  /** Reconstruye la entidad desde una fila de base de datos, con su estado real. */
  static fromPersistence(params: {
    id: ProposalId;
    tenantId: TenantId;
    organizationId: OrganizationId;
    brandId: BrandId | null;
    title: string;
    status: ProposalStatus;
    createdBy: UserId | null;
    createdAt: Date;
    submittedAt: Date | null;
  }): Proposal {
    return new Proposal(
      params.id,
      params.tenantId,
      params.organizationId,
      params.brandId,
      params.title,
      params.status,
      params.createdBy,
      params.createdAt,
      params.submittedAt,
    );
  }

  get isDraft(): boolean {
    return this.submittedAt === null;
  }

  markExtracted(): Proposal {
    return new Proposal(
      this.id,
      this.tenantId,
      this.organizationId,
      this.brandId,
      this.title,
      'extracted',
      this.createdBy,
      this.createdAt,
      this.submittedAt,
    );
  }
}
