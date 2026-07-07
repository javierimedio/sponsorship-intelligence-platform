-- 0005_profiles.sql
-- Extiende auth.users de Supabase con los datos de negocio del usuario.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  organization_id uuid references organizations(id),   -- null si es tenant_admin cross-org
  full_name text,
  role text not null,
  -- roles válidos en Fase 1: 'tenant_admin' | 'org_admin' | 'evaluator' |
  -- 'approver_marketing' | 'approver_direccion_marketing' | 'approver_direccion_comercial' |
  -- 'approver_ceo' | 'approver_finanzas' | 'approver_compras' | 'viewer'
  created_at timestamptz not null default now(),

  constraint profiles_org_required_unless_tenant_admin
    check (role = 'tenant_admin' or organization_id is not null)
);

create index idx_profiles_org on profiles(organization_id);
create index idx_profiles_tenant on profiles(tenant_id);

alter table profiles enable row level security;

create policy profiles_select on profiles for select
  using (
    tenant_id = current_tenant()
    and (is_tenant_admin() or organization_id = current_org() or id = auth.uid())
  );

-- Un usuario nunca se auto-asigna organización o rol: solo se inserta vía función de servidor
-- (Edge Function / Server Action) ejecutada con la service role key, nunca desde el cliente.
create policy profiles_update_own_name on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

comment on table profiles is
  'Datos de negocio del usuario autenticado: a qué tenant/organización pertenece y su rol.';
