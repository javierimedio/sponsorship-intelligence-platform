-- 0015_economic_concepts_block_type.sql
-- El Excel original agrupaba los conceptos económicos en bloques (Inversión, Retorno,
-- Comercial, Reputación, Producción, Interno), no solo en coste/resultado. Añadimos esa
-- dimensión sin romper lo ya evaluado — es una columna nueva, opcional para filas antiguas.

alter table economic_concepts add column block_type text;

comment on column economic_concepts.block_type is
  'Bloque económico del Excel original: Inversión | Retorno | Comercial | Reputación | Producción | Interno.';
