// src/domain/intake/proposal.ts

import { OrganizationId, ProposalId, TenantId, UserId } from '../shared/ids';

export type ProposalStatus = 'received' | 'extracting' | 'extracted';

export class Proposal {
  private constructor(
    public readonly id: ProposalId,
    public readonly tenantId: TenantId,
    public readonly organizationId: OrganizationId,
    public readonly title: string,
    public readonly status: ProposalStatus,
    public readonly createdBy: UserId | null,
    public readonly createdAt: Date,
  ) {}

  static create(params: {
    id: ProposalId;
    tenantId: TenantId;
    organizationId: OrganizationId;
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
      params.title,
      'received',
      params.createdBy,
      params.createdAt,
    );
  }

  startExtraction(): Proposal {
    return new Proposal(
      this.id,
      this.tenantId,
      this.organizationId,
      this.title,
      'extracting',
      this.createdBy,
      this.createdAt,
    );
  }
}
