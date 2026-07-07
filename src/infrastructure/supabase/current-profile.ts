// src/infrastructure/supabase/current-profile.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { asOrganizationId, asTenantId, asUserId } from '../../domain/shared/ids';

export interface CurrentProfile {
  userId: ReturnType<typeof asUserId>;
  tenantId: ReturnType<typeof asTenantId>;
  organizationId: ReturnType<typeof asOrganizationId>;
  appRole: string;
}

/**
 * Lee el perfil de negocio (tenant/organización/rol) del usuario autenticado
 * en la request actual. Devuelve null si no hay sesión o no tiene perfil.
 */
export async function getCurrentProfile(client: SupabaseClient): Promise<CurrentProfile | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await client
    .from('profiles')
    .select('id, tenant_id, organization_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile || !profile.organization_id) return null;

  return {
    userId: asUserId(profile.id),
    tenantId: asTenantId(profile.tenant_id),
    organizationId: asOrganizationId(profile.organization_id),
    appRole: profile.role,
  };
}
