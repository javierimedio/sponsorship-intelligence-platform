-- 0013_evaluation_results.sql

alter table proposals add column total_score numeric(5,4);
alter table proposals add column overall_risk_level text;
alter table proposals add column recommendation text;

create table proposal_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  scoring_attribute_id uuid not null references scoring_attributes(id),
  score_value numeric(5,4) not null,
  ai_rationale text,
  source text not null default 'ai',
  created_at timestamptz not null default now()
);

create table proposal_risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  risk_factor_id uuid not null references risk_factors(id),
  level text not null,
  impact text not null,
  computed_score int not null,
  source text not null default 'ai',
  created_at timestamptz not null default now()
);

create table proposal_financials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  economic_concept_id uuid not null references economic_concepts(id),
  estimated_amount numeric(12,2),
  source text not null default 'ai',
  created_at timestamptz not null default now()
);

create index idx_proposal_scores_proposal on proposal_scores(proposal_id);
create index idx_proposal_risks_proposal on proposal_risks(proposal_id);
create index idx_proposal_financials_proposal on proposal_financials(proposal_id);

alter table proposal_scores enable row level security;
alter table proposal_risks enable row level security;
alter table proposal_financials enable row level security;

create policy proposal_scores_select on proposal_scores for select
  using (tenant_id = current_tenant() and (is_tenant_admin() or organization_id = current_org()));
create policy proposal_scores_insert on proposal_scores for insert
  with check (tenant_id = current_tenant() and organization_id = current_org());

create policy proposal_risks_select on proposal_risks for select
  using (tenant_id = current_tenant() and (is_tenant_admin() or organization_id = current_org()));
create policy proposal_risks_insert on proposal_risks for insert
  with check (tenant_id = current_tenant() and organization_id = current_org());

create policy proposal_financials_select on proposal_financials for select
  using (tenant_id = current_tenant() and (is_tenant_admin() or organization_id = current_org()));
create policy proposal_financials_insert on proposal_financials for insert
  with check (tenant_id = current_tenant() and organization_id = current_org());

comment on column proposals.recommendation is
  'MVP: calculado con un umbral fijo en código (EvaluateProposalUseCase), no con
   un Rule Engine configurable todavía. Ver Documento 4 para la versión completa.';
