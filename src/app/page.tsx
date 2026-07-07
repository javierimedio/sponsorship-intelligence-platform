import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: organizations, error } = await supabase.from('organizations').select('id, name');

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>GorFactory Collaboration Intelligence — Fase 1</h1>
      <p>Verificación de conexión a Supabase (respeta RLS de la sesión actual):</p>
      {error ? (
        <pre style={{ color: 'crimson' }}>{error.message}</pre>
      ) : (
        <ul>
          {(organizations ?? []).map((org) => (
            <li key={org.id}>{org.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
