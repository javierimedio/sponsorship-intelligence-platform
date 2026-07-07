-- 0011_ai_extractions.sql
-- Estructura lista para cuando conectemos el Agente 1 (extracción). Por ahora no hay
-- ninguna llamada a un proveedor de IA todavía — esta tabla solo evita una migración
-- adicional cuando lo conectemos.

create table ai_extractions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  document_id uuid references documents(id),
  model_used text,
  extracted_json jsonb,
  confidence numeric(3,2),
  status text not null default 'pending',
  -- 'pending' | 'completed' | 'needs_review' | 'failed'
  created_at timestamptz not null default now()
);

create index idx_extractions_proposal on ai_extractions(proposal_id);

alter table ai_extractions enable row level security;

create policy ai_extractions_select on ai_extractions for select
  using (
    tenant_id = current_tenant()
    and (is_tenant_admin() or organization_id = current_org())
  );

create policy ai_extractions_insert on ai_extractions for insert
  with check (
    tenant_id = current_tenant()
    and organization_id = current_org()
  );

comment on table ai_extractions is
  'Resultado de la extracción del Agente 1 sobre un documento. Vacía hasta que conectemos
   el proveedor de IA — el módulo Intake ya deja el hueco listo.';
