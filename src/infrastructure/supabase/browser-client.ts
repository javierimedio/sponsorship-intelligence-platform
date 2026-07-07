// src/infrastructure/supabase/browser-client.ts
// Cliente Supabase para Client Components (formularios, botones interactivos).
// Usa la anon/publishable key — nunca la service role key aquí.

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
