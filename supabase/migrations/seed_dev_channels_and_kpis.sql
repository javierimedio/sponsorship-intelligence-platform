-- seed_dev_channels_and_kpis.sql
-- Datos FICTICIOS para desarrollo, vinculados a 'Empresa Demo A'.

insert into channels (organization_id, name) values
  ('00000000-0000-0000-0000-000000000011', 'Instagram'),
  ('00000000-0000-0000-0000-000000000011', 'LinkedIn'),
  ('00000000-0000-0000-0000-000000000011', 'Web corporativa'),
  ('00000000-0000-0000-0000-000000000011', 'PR / Prensa'),
  ('00000000-0000-0000-0000-000000000011', 'Email interno');

insert into kpi_definitions (organization_id, name) values
  ('00000000-0000-0000-0000-000000000011', 'Alcance'),
  ('00000000-0000-0000-0000-000000000011', 'Interacciones'),
  ('00000000-0000-0000-0000-000000000011', 'Leads'),
  ('00000000-0000-0000-0000-000000000011', 'Impresiones'),
  ('00000000-0000-0000-0000-000000000011', 'Asistentes al evento');
