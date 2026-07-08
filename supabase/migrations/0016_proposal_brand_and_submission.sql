-- 0016_proposal_brand_and_submission.sql

-- ¿Para qué marca es esta propuesta? NULL = corporativo (la organización en sí, no una
-- marca concreta) — ej. Gor Factory como marca corporativa vs. Roly/Roly WRK/Stamina/Musai.
alter table proposals add column brand_id uuid references brands(id);

-- Mientras submitted_at es NULL, la propuesta es un BORRADOR: editable, se puede
-- re-extraer, re-evaluar y replanificar la activación tantas veces como haga falta.
-- Al enviarla, se fija esta fecha y queda bloqueada para edición (ver ruta
-- /api/proposals/[id]/submit, que exige que ya tenga recomendación calculada).
alter table proposals add column submitted_at timestamptz;

create index idx_proposals_brand on proposals(brand_id);

comment on column proposals.submitted_at is
  'NULL = borrador (editable). Con fecha = enviada (bloqueada). Se exige recommendation
   no nulo antes de poder fijarla — ver /api/proposals/[id]/submit.';
