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
   ```
3. En el dashboard de Supabase: **Authentication → Hooks → Custom Access Token Hook** → apuntar a `public.custom_access_token_hook` (no se puede activar por SQL).
4. (Opcional, solo en el proyecto de desarrollo) cargar `supabase/migrations/seed_dev_tenancy.sql` — son datos ficticios, nunca reales.
5. Copiar `.env.example` a `.env.local` y rellenar con las credenciales del proyecto de desarrollo.
6. `npm install`
7. `npm run dev`

## Siguiente paso de desarrollo

Con esta capa levantada y probada (crear una organización, un usuario, comprobar que el JWT lleva `tenant_id`/`organization_id`/`role` y que la RLS bloquea cruces entre organizaciones), el siguiente módulo es **Intake & Extraction**: tablas `documents` + `ai_extractions` + Agente 1, siguiendo el mismo patrón de esta capa (migración → dominio → caso de uso → adapter Supabase).
