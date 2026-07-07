// src/domain/tenancy/organization.ts

import { OrganizationId, TenantId } from '../shared/ids';

export class Organization {
  private constructor(
    public readonly id: OrganizationId,
    public readonly tenantId: TenantId,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}

  static create(params: {
    id: OrganizationId;
    tenantId: TenantId;
    name: string;
    createdAt: Date;
  }): Organization {
    if (!params.name.trim()) {
      throw new Error('El nombre de la organización no puede estar vacío.');
    }
    return new Organization(params.id, params.tenantId, params.name, params.createdAt);
  }
}
