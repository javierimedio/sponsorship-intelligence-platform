-- 0003_organizations.sql

create table organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  created_at timestamptz not null default now()
);

create index idx_organizations_tenant on organizations(tenant_id);

alter table organizations enable row level security;

-- Lectura: tenant_admin ve todas las organizaciones de su tenant; el resto solo la suya.
create policy organizations_select on organizations for select
  using (
    tenant_id = current_tenant()
    and (is_tenant_admin() or id = current_org())
  );

-- Escritura: reservada a tenant_admin (crear una organización nueva es una operación de grupo, no de org).
create policy organizations_insert on organizations for insert
  with check (tenant_id = current_tenant() and is_tenant_admin());

create policy organizations_update on organizations for update
  using (tenant_id = current_tenant() and is_tenant_admin());

comment on table organizations is
  'Empresa del grupo (Gor Factory, Musai, Tex Point...). Límite de negocio dentro de un tenant.';
