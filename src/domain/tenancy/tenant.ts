// src/domain/tenancy/tenant.ts

import { TenantId } from '../shared/ids';

export class Tenant {
  private constructor(
    public readonly id: TenantId,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}

  static create(params: { id: TenantId; name: string; createdAt: Date }): Tenant {
    if (!params.name.trim()) {
      throw new Error('El nombre del tenant no puede estar vacío.');
    }
    return new Tenant(params.id, params.name, params.createdAt);
  }
}
