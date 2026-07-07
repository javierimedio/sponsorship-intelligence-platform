// src/infrastructure/supabase/brand-repository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { Brand } from '../../domain/tenancy/brand';
import { BrandRepository } from '../../domain/tenancy/repositories';
import { asBrandId, asOrganizationId, BrandId, OrganizationId } from '../../domain/shared/ids';

interface BrandRow {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
}

function toDomain(row: BrandRow): Brand {
  return Brand.create({
    id: asBrandId(row.id),
    organizationId: asOrganizationId(row.organization_id),
    name: row.name,
    isActive: row.is_active,
  });
}

export class SupabaseBrandRepository implements BrandRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: BrandId): Promise<Brand | null> {
    const { data, error } = await this.client
      .from('brands')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findAllByOrganization(organizationId: OrganizationId): Promise<Brand[]> {
    const { data, error } = await this.client
      .from('brands')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async save(brand: Brand): Promise<void> {
    const { error } = await this.client.from('brands').upsert({
      id: brand.id,
      organization_id: brand.organizationId,
      name: brand.name,
      is_active: brand.isActive,
    });

    if (error) throw error;
  }
}
