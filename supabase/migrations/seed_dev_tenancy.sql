-- seed_dev_tenancy.sql
-- Datos FICTICIOS para desarrollo local. No ejecutar contra staging/producción.
-- Para probar con casos reales, cargadlos manualmente en el proyecto Supabase de staging,
-- nunca en un archivo versionado en el repositorio.

insert into tenants (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Grupo Demo');

insert into organizations (id, tenant_id, name) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Empresa Demo A'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Empresa Demo B');

insert into brands (organization_id, name) values
  ('00000000-0000-0000-0000-000000000011', 'Marca Demo 1'),
  ('00000000-0000-0000-0000-000000000011', 'Marca Demo 2'),
  ('00000000-0000-0000-0000-000000000012', 'Marca Demo 3');

-- Nota: las filas de `profiles` no se seedean aquí porque dependen de auth.users,
-- que se crea vía Supabase Auth (signup), no por SQL directo.
