// src/infrastructure/supabase/admin-client.ts
// Usa SUPABASE_SERVICE_ROLE_KEY — se salta toda la RLS. SOLO se instancia dentro de
// Route Handlers, después de comprobar que quien llama es org_admin. NUNCA se expone
// al navegador ni se importa desde un componente cliente.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
