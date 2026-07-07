-- 0006_auth_hook_custom_claims.sql
-- Supabase Auth Hook: se ejecuta al emitir cada JWT y añade tenant_id/organization_id/role
-- leyendo de `profiles`. Sin esto, current_tenant()/current_org()/is_tenant_admin() no tendrían
-- de dónde leer y toda la RLS de las migraciones anteriores quedaría bloqueando todo.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
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

-- Activar en el dashboard de Supabase: Authentication > Hooks > Custom Access Token Hook
-- apuntando a public.custom_access_token_hook. No se puede activar por SQL puro.

comment on function public.custom_access_token_hook is
  'Puebla tenant_id/organization_id/role en el JWT en cada login/refresh, leyendo de profiles.';
