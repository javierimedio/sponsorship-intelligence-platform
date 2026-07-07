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
   supabase/migrations/0012_evaluation_catalog.sql
   supabase/migrations/0013_evaluation_results.sql
   ```
3. En el dashboard de Supabase: **Authentication → Hooks → Custom Access Token Hook** → apuntar a `public.custom_access_token_hook` (no se puede activar por SQL).
4. (Opcional, solo en el proyecto de desarrollo) cargar los seeds — son datos ficticios, nunca reales:
   - `supabase/migrations/seed_dev_tenancy.sql`
   - `supabase/migrations/seed_dev_evaluation_catalog.sql`
5. Crea manualmente un usuario en **Authentication → Users** y vincúlalo a un perfil:
   ```sql
   insert into profiles (id, tenant_id, organization_id, full_name, role)
   select u.id, '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000011', 'Tu nombre', 'org_admin'
   from auth.users u where u.email = 'tu@email.com';
   ```
6. Copiar `.env.example` a `.env.local`. Con `AI_PROVIDER=manual` (valor por defecto) no necesitas ninguna clave de IA — en `/intake` tú mismo rellenas los datos que rellenaría un Agente, y el motor de scoring/riesgo/recomendación es idéntico. Para activar IA real más adelante, cambia `AI_PROVIDER` a `openai`/`anthropic`/`gemini` y rellena la clave correspondiente — ningún código cambia.
7. `npm install`
8. `npm run dev`

## Lecciones de la puesta en marcha (para no repetirlas)

- El claim del JWT para el rol de negocio **nunca** debe llamarse `role` — es un nombre reservado que usa PostgREST para decidir con qué rol de PostgreSQL ejecutar cada request. Lo llamamos `app_role`.
- El Auth Hook necesita `security definer` + `grant select` explícito a `supabase_auth_admin` sobre `profiles`, porque si no, la RLS de esa tabla bloquea al propio hook y el login devuelve 500.
- Activar el Auth Hook en el dashboard es un paso manual — no se puede hacer por SQL.
- El middleware de Next.js necesita tipar explícitamente `CookieOptions` (de `@supabase/ssr`) en los parámetros `options` de `set`/`remove`, o falla la comprobación de tipos en build (aunque compile bien en local con `strict: false`).

## Estado actual (Fase 1, MVP funcionando de extremo a extremo)

- **Tenant/Organization/Brand + Auth + RLS**: verificado en producción.
- **Intake & Extraction**: crear propuesta, subir documento a Storage, Agente 1 (Claude) extrae datos estructurados.
- **Evaluation**: Agentes 2/3/5 (scoring, riesgo, financials) en paralelo sobre el catálogo de la organización, con recomendación determinista.

**Simplificaciones deliberadas de este MVP** frente al diseño completo de los Documentos 3-4 (para que exista algo funcionando de extremo a extremo antes de añadir sofisticación):
- No hay `scoring_model_versions` ni Rule Engine configurable todavía — los pesos/catálogos son fijos por organización, editables directamente en las tablas.
- La recomendación final es una función con umbral fijo en código (`computeRecommendation`), no una tabla `recommendation_rules` configurable.
- No hay Global Confidence Score, `human_feedback`, ni Knowledge Engine — quedan para cuando haya histórico real que aprovechar.
- El proveedor de IA por defecto es **`manual`** — tras comprobar que Gemini (bloqueado por región en España/UE) y OpenAI (cuenta de API nueva sin saldo) no funcionaban sin activar facturación en algún sitio, se construyó un tercer camino que no depende de ningún proveedor: en `/intake`, cuando `AI_PROVIDER=manual`, el usuario rellena directamente los mismos datos que rellenaría un Agente (extracción, scoring, riesgo, financials) en formularios, y `buildEvaluationOutcome()` calcula el resultado exactamente igual que con IA — la única diferencia registrada es `source='manual'` en `proposal_scores`/`proposal_risks`/`proposal_financials`. Esto permite validar TODO el resto de la plataforma (RLS, Storage, catálogo, matriz de riesgo, recomendación) sin depender de que nadie apruebe un gasto. El puerto `AIProvider` es idéntico para Claude/Gemini/OpenAI; cambiar entre ellos (o al modo manual) es solo la variable de entorno `AI_PROVIDER`.
- Limitación conocida del adapter de OpenAI: no acepta PDF directamente por la API de Chat Completions — solo imágenes (PNG/JPG) — para PDF con OpenAI haría falta conectar su Files API (pendiente).

## Siguiente paso de desarrollo

Con Intake + Evaluation funcionando end-to-end, las líneas naturales desde aquí son:
1. **Aprobación**: un flujo simple de aprobar/rechazar sobre el `recommendation` calculado (antes del Rule Engine completo).
2. **Probar con documentos reales anonimizados** — es el momento de validar si el catálogo de scoring/riesgo semilla tiene sentido para el negocio real, antes de construir más encima.
3. Endurecer el MVP: versionado de modelo, Rule Engine, panel de configuración del catálogo (hoy solo editable por SQL).
