-- 0004_brands.sql

create table brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_brands_org on brands(organization_id);

alter table brands enable row level security;

create policy brands_select on brands for select
  using (
    exists (
      select 1 from organizations o
      where o.id = brands.organization_id
        and o.tenant_id = current_tenant()
        and (is_tenant_admin() or o.id = current_org())
    )
  );

create policy brands_insert on brands for insert
  with check (organization_id = current_org() or is_tenant_admin());

create policy brands_update on brands for update
  using (organization_id = current_org() or is_tenant_admin());

comment on table brands is
  'Marca operativa bajo una organización (ej. Roly, Roly WRK bajo Gor Factory).';
