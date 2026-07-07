-- 0008_fix_reserved_role_claim.sql
-- `role` es un nombre de claim RESERVADO en el JWT de Supabase: PostgREST lo usa para decidir
-- con qué rol de PostgreSQL (anon/authenticated/service_role) ejecutar cada request.
-- Al poner ahí nuestro rol de negocio ('org_admin', 'evaluator'...) PostgREST intenta
-- SET ROLE a un rol de sistema que no existe → "role ... does not exist".
-- Se renombra nuestro claim de negocio a `app_role`.

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
    -- 'app_role', NO 'role' — evita colisión con el claim reservado de PostgREST
    claims := jsonb_set(claims, '{app_role}', to_jsonb(profile_row.role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Actualizar la función auxiliar de RLS para leer del nuevo nombre de claim
create or replace function public.is_tenant_admin() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'app_role') = 'tenant_admin', false)
$$;

comment on function public.custom_access_token_hook is
  'Puebla tenant_id/organization_id/app_role en el JWT. NUNCA usar el nombre "role" '
  'para el rol de negocio — es un claim reservado de PostgREST.';
