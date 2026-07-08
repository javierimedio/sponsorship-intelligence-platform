-- seed_dev_costes_roi_and_activacion.sql
-- Datos FICTICIOS para desarrollo, vinculados a 'Empresa Demo A'. No ejecutar en producción.

-- Clasifica en bloque los conceptos ya sembrados anteriormente
update economic_concepts set block_type = 'Inversión'
  where name in ('Fee de patrocinio', 'Producción de contenido') and organization_id = '00000000-0000-0000-0000-000000000011';
update economic_concepts set block_type = 'Retorno'
  where name in ('Valor mediático estimado (EMV)', 'Leads estimados') and organization_id = '00000000-0000-0000-0000-000000000011';

-- Nuevos conceptos que cubren los bloques que faltaban del Excel original
insert into economic_concepts (organization_id, name, nature, block_type) values
  ('00000000-0000-0000-0000-000000000011', 'Activaciones comerciales', 'cost', 'Comercial'),
  ('00000000-0000-0000-0000-000000000011', 'Impacto reputacional estimado', 'result', 'Reputación'),
  ('00000000-0000-0000-0000-000000000011', 'Costes de producción audiovisual', 'cost', 'Producción'),
  ('00000000-0000-0000-0000-000000000011', 'Horas internas dedicadas (coste interno)', 'cost', 'Interno');

-- Catálogo cerrado de acciones de activación
insert into activation_catalog_items (organization_id, area, name) values
  ('00000000-0000-0000-0000-000000000011', 'RRSS', 'Publicación en Instagram'),
  ('00000000-0000-0000-0000-000000000011', 'RRSS', 'Reel / vídeo promocional'),
  ('00000000-0000-0000-0000-000000000011', 'Web', 'Banner en web corporativa'),
  ('00000000-0000-0000-0000-000000000011', 'Eventos', 'Presencia de marca en el evento'),
  ('00000000-0000-0000-0000-000000000011', 'PR', 'Nota de prensa'),
  ('00000000-0000-0000-0000-000000000011', 'Comercial', 'Descuento para empleados/clientes'),
  ('00000000-0000-0000-0000-000000000011', 'Interno', 'Comunicación interna (newsletter/intranet)');
