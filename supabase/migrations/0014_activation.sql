-- 0014_activation.sql
-- Módulo de Activación — pieza que faltaba del Excel original. Versión MVP: el usuario
-- elige del catálogo cerrado (nunca texto libre, mismo principio que el resto de la
-- plataforma: la IA/el humano NUNCA inventa una acción fuera de catálogo) + notas libres.
-- Campos más ricos (canal, prioridad, fechas, responsable, KPI) quedan para cuando este
-- módulo pase de "selección" a "gestión" real del plan de activación.

create table activation_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  area text not null,  -- 'RRSS' | 'Web' | 'Eventos' | 'Comercial' | 'PR' | 'Interno'
  name text not null
);

create table proposal_activations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  activation_catalog_item_id uuid not null references activation_catalog_items(id),
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index idx_proposal_activations_proposal on proposal_activations(proposal_id);

alter table activation_catalog_items enable row level security;
alter table proposal_activations enable row level security;

create policy activation_catalog_items_select on activation_catalog_items for select
  using (organization_id = current_org() or is_tenant_admin());
create policy activation_catalog_items_insert on activation_catalog_items for insert
  with check (organization_id = current_org());

create policy proposal_activations_select on proposal_activations for select
  using (tenant_id = current_tenant() and (is_tenant_admin() or organization_id = current_org()));
create policy proposal_activations_insert on proposal_activations for insert
  with check (tenant_id = current_tenant() and organization_id = current_org());
create policy proposal_activations_delete on proposal_activations for delete
  using (tenant_id = current_tenant() and organization_id = current_org());
