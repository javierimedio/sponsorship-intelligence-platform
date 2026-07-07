-- 0007_fix_auth_hook_permissions.sql
-- Corrige el Auth Hook: necesita SECURITY DEFINER + permisos explícitos sobre `profiles`
-- para poder leerla a pesar de tener RLS activado. Sin esto, el hook falla en tiempo de
-- ejecución y Supabase devuelve 500 en /auth/v1/token en cada intento de login.

-- 1. Recrear la función con SECURITY DEFINER y search_path fijo (buena práctica de seguridad
--    recomendada por Supabase para funciones que se ejecutan con privilegios elevados).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  profile_row record;
begin
  select tenant_id, organization_id, role
  into profile_row
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if profile_row is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(profile_row.tenant_id));
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(profile_row.organization_id));
    claims := jsonb_set(claims, '{role}', to_jsonb(profile_row.role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- 2. El rol interno que ejecuta los Auth Hooks necesita permiso de uso del esquema
--    y de ejecución de la función.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- 3. Por seguridad, nadie más (usuarios normales autenticados o anónimos) debe poder
--    ejecutar esta función directamente.
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- 4. El rol supabase_auth_admin necesita poder LEER la tabla profiles.
--    RLS sigue activo para todo el mundo excepto para esta política específica.
grant select on table public.profiles to supabase_auth_admin;

drop policy if exists "auth_admin_read_profiles" on public.profiles;
create policy "auth_admin_read_profiles" on public.profiles
  as permissive
  for select
  to supabase_auth_admin
  using (true);

comment on function public.custom_access_token_hook is
  'Puebla tenant_id/organization_id/role en el JWT en cada login/refresh. '
  'Requiere SECURITY DEFINER + permisos explícitos sobre profiles para saltar su RLS.';
