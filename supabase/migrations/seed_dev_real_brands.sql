-- seed_dev_real_brands.sql
-- Marcas reales bajo las que se pueden crear propuestas, además de la opción
-- "Corporativo" (brand_id = null). Idempotente: no duplica si ya existen.

insert into brands (organization_id, name)
select '00000000-0000-0000-0000-000000000011', v.name
from (values ('Roly'), ('Roly WRK'), ('Stamina'), ('Musai')) as v(name)
where not exists (
  select 1 from brands b
  where b.organization_id = '00000000-0000-0000-0000-000000000011' and b.name = v.name
);
