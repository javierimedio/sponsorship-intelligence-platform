-- seed_dev_evaluation_catalog.sql
-- Catálogo FICTICIO para desarrollo, vinculado a 'Empresa Demo A' del seed de tenancy.
-- No ejecutar contra staging/producción.

insert into scoring_blocks (id, organization_id, name, max_weight, sort_order) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Afinidad estratégica', 0.30, 1),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'Potencial comercial', 0.40, 2),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000011', 'Visibilidad y alcance', 0.30, 3);

insert into scoring_attributes (scoring_block_id, name, max_score, sort_order) values
  ('10000000-0000-0000-0000-000000000001', 'Afinidad de marca', 0.15, 1),
  ('10000000-0000-0000-0000-000000000001', 'Coherencia de valores', 0.15, 2),
  ('10000000-0000-0000-0000-000000000002', 'Potencial de ventas', 0.20, 1),
  ('10000000-0000-0000-0000-000000000002', 'Generación de leads', 0.20, 2),
  ('10000000-0000-0000-0000-000000000003', 'Alcance estimado', 0.15, 1),
  ('10000000-0000-0000-0000-000000000003', 'Calidad del contenido generado', 0.15, 2);

insert into risk_blocks (id, organization_id, name) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Riesgo financiero'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'Riesgo reputacional');

insert into risk_factors (risk_block_id, name) values
  ('20000000-0000-0000-0000-000000000001', 'Coste elevado respecto al presupuesto habitual'),
  ('20000000-0000-0000-0000-000000000001', 'ROI incierto o difícil de medir'),
  ('20000000-0000-0000-0000-000000000002', 'Controversia pública del solicitante'),
  ('20000000-0000-0000-0000-000000000002', 'Desalineación con los valores de marca');

insert into risk_matrix_rules (organization_id, level, impact, score) values
  ('00000000-0000-0000-0000-000000000011', 'Alto',  'Alto',  9),
  ('00000000-0000-0000-0000-000000000011', 'Alto',  'Medio', 6),
  ('00000000-0000-0000-0000-000000000011', 'Alto',  'Bajo',  3),
  ('00000000-0000-0000-0000-000000000011', 'Medio', 'Alto',  6),
  ('00000000-0000-0000-0000-000000000011', 'Medio', 'Medio', 4),
  ('00000000-0000-0000-0000-000000000011', 'Medio', 'Bajo',  2),
  ('00000000-0000-0000-0000-000000000011', 'Bajo',  'Alto',  3),
  ('00000000-0000-0000-0000-000000000011', 'Bajo',  'Medio', 2),
  ('00000000-0000-0000-0000-000000000011', 'Bajo',  'Bajo',  1);

insert into economic_concepts (organization_id, name, nature) values
  ('00000000-0000-0000-0000-000000000011', 'Fee de patrocinio', 'cost'),
  ('00000000-0000-0000-0000-000000000011', 'Producción de contenido', 'cost'),
  ('00000000-0000-0000-0000-000000000011', 'Valor mediático estimado (EMV)', 'result'),
  ('00000000-0000-0000-0000-000000000011', 'Leads estimados', 'result');
