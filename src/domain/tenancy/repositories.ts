// src/domain/tenancy/repositories.ts
// Puertos que el dominio necesita. La capa de aplicación depende de estas interfaces,
// nunca de Supabase directamente — así los casos de uso son testeables sin base de datos real.

import { Brand } from './brand';
import { Organization } from './organization';
import { BrandId, OrganizationId, TenantId } from '../shared/ids';

export interface OrganizationRepository {
  findById(id: OrganizationId): Promise<Organization | null>;
  findAllByTenant(tenantId: TenantId): Promise<Organization[]>;
  save(organization: Organization): Promise<void>;
}

export interface BrandRepository {
  findById(id: BrandId): Promise<Brand | null>;
  findAllByOrganization(organizationId: OrganizationId): Promise<Brand[]>;
  save(brand: Brand): Promise<void>;
}
