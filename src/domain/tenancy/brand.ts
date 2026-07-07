// src/domain/tenancy/brand.ts

import { BrandId, OrganizationId } from '../shared/ids';

export class Brand {
  private constructor(
    public readonly id: BrandId,
    public readonly organizationId: OrganizationId,
    public readonly name: string,
    public readonly isActive: boolean,
  ) {}

  static create(params: {
    id: BrandId;
    organizationId: OrganizationId;
    name: string;
    isActive?: boolean;
  }): Brand {
    if (!params.name.trim()) {
      throw new Error('El nombre de la marca no puede estar vacío.');
    }
    return new Brand(params.id, params.organizationId, params.name, params.isActive ?? true);
  }

  deactivate(): Brand {
    return new Brand(this.id, this.organizationId, this.name, false);
  }
}
