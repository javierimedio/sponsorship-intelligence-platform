-- 0018_activation_actions_rich.sql
-- Sustituye el modelo "checklist + una nota compartida" por acciones individuales,
-- cada una con su propio ciclo de vida — igual que la hoja "activación" del Excel
-- original. Se permite repetir el mismo activation_catalog_item_id varias veces
-- (dos publicaciones de Instagram distintas, por ejemplo).

create table channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null
);

create table kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null
);

alter table proposal_activations
  add column channel_id uuid references channels(id),
  add column objective text,
  add column description text,
  add column priority text,          -- 'Alta' | 'Media' | 'Baja'
  add column expected_impact text,   -- 'Alto' | 'Medio' | 'Bajo'
  add column effort text,            -- 'Alto' | 'Medio' | 'Bajo'
  add column responsible text,
  add column start_date date,
  add column end_date date,
  add column status text not null default 'pending', -- 'pending'|'in_progress'|'done'|'cancelled'
  add column kpi_definition_id uuid references kpi_definitions(id),
  add column kpi_target text,
  add column kpi_result text,        -- se rellena durante el seguimiento, después de ejecutar
  add column is_reusable boolean,
  add column useful_life text;       -- '<1 mes' | '1-3 meses' | '3-6 meses' | '6-12 meses' | '>12 meses'

alter table channels enable row level security;
alter table kpi_definitions enable row level security;

create policy channels_select on channels for select
  using (organization_id = current_org() or is_tenant_admin());
create policy channels_insert on channels for insert
  with check (organization_id = current_org());

create policy kpi_definitions_select on kpi_definitions for select
  using (organization_id = current_org() or is_tenant_admin());
create policy kpi_definitions_insert on kpi_definitions for insert
  with check (organization_id = current_org());

-- Antes solo se borraba y volvía a insertar todo el plan de golpe (0014). Ahora cada
-- acción es una fila independiente que se puede editar (por ejemplo, para el
-- seguimiento: marcar status='done' y rellenar kpi_result cuando se ejecuta de verdad).
create policy proposal_activations_update on proposal_activations for update
  using (tenant_id = current_tenant() and organization_id = current_org());

comment on table proposal_activations is
  'Cada fila es UNA acción de activación planificada (no un checklist). Se puede repetir
   el mismo activation_catalog_item_id varias veces. El seguimiento post-ejecución se hace
   actualizando status y kpi_result de la fila, nunca borrando y recreando.';
