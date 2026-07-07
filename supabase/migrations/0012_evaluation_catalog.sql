-- 0012_evaluation_catalog.sql
-- Catálogo configurable de Evaluation. Versión MVP: sin Rule Engine todavía
-- (los pesos y factores son fijos por organización, editables directamente en la tabla).
-- El versionado de modelo y el Rule Engine completo del Documento 3/4 quedan para cuando
-- el negocio necesite cambiar reglas sin tocar datos ya evaluados — de momento, alcance
-- reducido a propósito para tener el motor funcionando de extremo a extremo.

create table scoring_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  max_weight numeric(5,4) not null,
  sort_order int not null default 0
);

create table scoring_attributes (
  id uuid primary key default gen_random_uuid(),
  scoring_block_id uuid not null references scoring_blocks(id),
  name text not null,
  max_score numeric(5,4) not null,
  sort_order int not null default 0
);

create table risk_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null
);

create table risk_factors (
  id uuid primary key default gen_random_uuid(),
  risk_block_id uuid not null references risk_blocks(id),
  name text not null
);

create table risk_matrix_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  level text not null,   -- 'Alto' | 'Medio' | 'Bajo'
  impact text not null,  -- 'Alto' | 'Medio' | 'Bajo'
  score int not null,
  unique(organization_id, level, impact)
);

create table economic_concepts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  nature text not null -- 'cost' | 'result'
);

alter table scoring_blocks enable row level security;
alter table scoring_attributes enable row level security;
alter table risk_blocks enable row level security;
alter table risk_factors enable row level security;
alter table risk_matrix_rules enable row level security;
alter table economic_concepts enable row level security;

create policy scoring_blocks_select on scoring_blocks for select
  using (organization_id = current_org() or is_tenant_admin());
create policy scoring_blocks_insert on scoring_blocks for insert
  with check (organization_id = current_org());

create policy scoring_attributes_select on scoring_attributes for select
  using (exists (
    select 1 from scoring_blocks b
    where b.id = scoring_attributes.scoring_block_id
      and (b.organization_id = current_org() or is_tenant_admin())
  ));
create policy scoring_attributes_insert on scoring_attributes for insert
  with check (exists (
    select 1 from scoring_blocks b
    where b.id = scoring_attributes.scoring_block_id and b.organization_id = current_org()
  ));

create policy risk_blocks_select on risk_blocks for select
  using (organization_id = current_org() or is_tenant_admin());
create policy risk_blocks_insert on risk_blocks for insert
  with check (organization_id = current_org());

create policy risk_factors_select on risk_factors for select
  using (exists (
    select 1 from risk_blocks b
    where b.id = risk_factors.risk_block_id
      and (b.organization_id = current_org() or is_tenant_admin())
  ));
create policy risk_factors_insert on risk_factors for insert
  with check (exists (
    select 1 from risk_blocks b
    where b.id = risk_factors.risk_block_id and b.organization_id = current_org()
  ));

create policy risk_matrix_rules_select on risk_matrix_rules for select
  using (organization_id = current_org() or is_tenant_admin());
create policy risk_matrix_rules_insert on risk_matrix_rules for insert
  with check (organization_id = current_org());

create policy economic_concepts_select on economic_concepts for select
  using (organization_id = current_org() or is_tenant_admin());
create policy economic_concepts_insert on economic_concepts for insert
  with check (organization_id = current_org());
