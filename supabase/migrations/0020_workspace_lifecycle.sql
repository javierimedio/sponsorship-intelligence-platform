-- 0020_workspace_lifecycle.sql
-- Los dos únicos campos nuevos que requiere el Workspace adaptativo (Documento 6, §9):
-- approved_at / finalized_at completan el ciclo Borrador → Evaluada → Aprobada → Finalizada
-- sin tocar el motor de cálculo. partner_name es una denormalización barata (mismo patrón
-- que profiles.email) para poder listar/mostrar el partner sin esperar al módulo completo
-- de Partners (Documento 3, Fase 2) — se rellena automáticamente cada vez que se guarda
-- una extracción, tomando requester_org.

alter table proposals add column approved_at timestamptz;
alter table proposals add column finalized_at timestamptz;
alter table proposals add column partner_name text;

comment on column proposals.approved_at is
  'NULL = todavía no aprobada. Requiere recommendation no nulo (ver /api/proposals/[id]/approve).';
comment on column proposals.finalized_at is
  'NULL = todavía no finalizada. Requiere approved_at no nulo (ver /api/proposals/[id]/finalize).';
comment on column proposals.partner_name is
  'Denormalizado desde ai_extractions.extracted_json.requester_org — provisional hasta que
   exista un módulo real de Partners (Documento 3, Fase 2).';
