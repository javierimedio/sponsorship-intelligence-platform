# GorFactory Collaboration Intelligence Platform

Scaffold inicial — implementa la primera capa acordada en la arquitectura (documentos 1-4):
**Tenant → Organization → Brand → Profiles/Auth → RLS**.

## Estructura (Clean Architecture)

```
src/
  domain/            # Entidades, Value Objects, interfaces de repositorio. Cero dependencias externas.
    shared/          # Tipos compartidos (ids nominales)
    tenancy/         # Tenant, Organization, Brand + puertos de repositorio
  application/        # Casos de uso. Dependen de interfaces de dominio, nunca de Supabase directamente.
    use-cases/tenancy/
  infrastructure/     # Adapters reales: Supabase, proveedores de IA (se añadirán por módulo)
    supabase/
  app/                 # Next.js App Router (capa de presentación)
supabase/
  migrations/          # SQL numerado y secuencial, una entidad por archivo, RLS en la misma migración
```

Regla de dependencia: `domain` no importa nada de `application` ni `infrastructure`. `application` importa `domain` pero no Supabase. Solo `infrastructure` conoce Supabase.

## Arrancar en local

1. Crear un proyecto Supabase de **desarrollo** (no el de staging/producción).
2. Ejecutar las migraciones en orden contra ese proyecto:
   ```
   supabase/migrations/0001_tenants.sql
   supabase/migrations/0002_auth_helper_functions.sql
   supabase/migrations/0003_organizations.sql
   supabase/migrations/0004_brands.sql
   supabase/migrations/0005_profiles.sql
   supabase/migrations/0006_auth_hook_custom_claims.sql
   supabase/migrations/0007_fix_auth_hook_permissions.sql
   supabase/migrations/0008_fix_reserved_role_claim.sql
   supabase/migrations/0009_proposals_minimal.sql
   supabase/migrations/0010_documents_and_storage.sql
   supabase/migrations/0011_ai_extractions.sql
   ```
3. En el dashboard de Supabase: **Authentication → Hooks → Custom Access Token Hook** → apuntar a `public.custom_access_token_hook` (no se puede activar por SQL).
4. (Opcional, solo en el proyecto de desarrollo) cargar `supabase/migrations/seed_dev_tenancy.sql` — son datos ficticios, nunca reales.
5. Crea manualmente un usuario en **Authentication → Users** y vincúlalo a un perfil:
   ```sql
   insert into profiles (id, tenant_id, organization_id, full_name, role)
   select u.id, '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011', 'Tu nombre', 'org_admin'
   from auth.users u where u.email = 'tu@email.com';
   ```
6. Copiar `.env.example` a `.env.local` y rellenar con las credenciales del proyecto de desarrollo.
7. `npm install`
8. `npm run dev`

## Lecciones de la puesta en marcha (para no repetirlas)

- El claim del JWT para el rol de negocio **nunca** debe llamarse `role` — es un nombre reservado que usa PostgREST para decidir con qué rol de PostgreSQL ejecutar cada request. Lo llamamos `app_role`.
- El Auth Hook necesita `security definer` + `grant select` explícito a `supabase_auth_admin` sobre `profiles`, porque si no, la RLS de esa tabla bloquea al propio hook y el login devuelve 500.
- Activar el Auth Hook en el dashboard es un paso manual — no se puede hacer por SQL.

## Siguiente paso de desarrollo

Con Tenant/Auth/RLS e Intake & Extraction levantados (crear una propuesta desde `/intake`, subir un documento, verlo registrado en `documents`), el siguiente módulo es conectar el **Agente 1 (extracción)**: al confirmarse la subida, una función procesa el documento y rellena `ai_extractions` con el contenido normalizado, siguiendo el mismo patrón (migración → dominio → caso de uso → adapter) que ya está establecido.
