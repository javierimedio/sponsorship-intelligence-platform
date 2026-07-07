-- 0009_proposals_minimal.sql
-- Versión mínima de `proposals` para el módulo Intake & Extraction: solo lo necesario
-- para que un documento pueda "colgar" de algo. Los campos de scoring/riesgo/financials
-- (collaboration_type_id, scoring_model_version_id, etc.) se añaden en la migración
-- del módulo Evaluation, sin romper esta tabla — solo con `alter table add column`.

create table proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  title text not null,
  status text not null default 'received',
  -- valores válidos por ahora: 'received' | 'extracting' | 'extracted'
  -- (los estados de evaluación/aprobación se añaden en fases posteriores)
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_proposals_org on proposals(organization_id);
create index idx_proposals_tenant on proposals(tenant_id);

alter table proposals enable row level security;

create policy proposals_select on proposals for select
  using (
    tenant_id = current_tenant()
    and (is_tenant_admin() or organization_id = current_org())
  );

create policy proposals_insert on proposals for insert
  with check (
    tenant_id = current_tenant()
    and organization_id = current_org()
  );

create policy proposals_update on proposals for update
  using (
    tenant_id = current_tenant()
    and (is_tenant_admin() or organization_id = current_org())
  );

comment on table proposals is
  'Versión mínima de Fase 1 (solo Intake). Se amplía con columnas de Evaluation más adelante.';
