-- 0002_auth_helper_functions.sql
-- Funciones que leen los custom claims del JWT (poblados por un Auth Hook al login).
-- Se crean ANTES de cualquier política de RLS porque todas dependen de ellas.

create or replace function current_tenant() returns uuid
language sql stable
as $$
  select (auth.jwt() ->> 'tenant_id')::uuid
$$;

create or replace function current_org() returns uuid
language sql stable
as $$
  select (auth.jwt() ->> 'organization_id')::uuid
$$;

create or replace function is_tenant_admin() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'role') = 'tenant_admin', false)
$$;

comment on function current_tenant() is
  'Tenant del usuario autenticado, extraído del JWT. Base de toda política de RLS.';
comment on function current_org() is
  'Organización del usuario autenticado. Null si es tenant_admin sin organización asignada.';
comment on function is_tenant_admin() is
  'true si el usuario tiene visibilidad sobre todas las organizaciones de su tenant.';
