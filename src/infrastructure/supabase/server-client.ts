// src/infrastructure/supabase/server-client.ts
// Cliente Supabase para uso en Server Components / Route Handlers.
// Nunca se usa la service role key aquí: se respeta siempre la sesión del usuario,
// para que la RLS (tenant/organization) se aplique tal cual está diseñada en las migraciones.
//
// set()/remove() van envueltos en try/catch: cuando este cliente se usa dentro de un
// Server Component (una página normal, no un Server Action ni un Route Handler),
// Next.js prohíbe modificar cookies y lanza "Cookies can only be modified in a Server
// Action or Route Handler" — justo cuando el token está a punto de expirar y Supabase
// intenta refrescarlo durante el render. El middleware.ts ya se encarga de refrescar y
// persistir la sesión en cada request, así que aquí basta con ignorar el fallo (es el
// comportamiento recomendado por la propia documentación de @supabase/ssr).

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Esperado en Server Components — el middleware ya refresca la sesión.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Esperado en Server Components — el middleware ya refresca la sesión.
          }
        },
      },
    },
  );
}
