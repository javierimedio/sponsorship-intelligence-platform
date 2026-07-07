import Link from 'next/link';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { SignOutButton } from './sign-out-button';

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h1>GorFactory Collaboration Intelligence — Fase 1</h1>
        <p>No has iniciado sesión.</p>
        <Link href="/login">Iniciar sesión</Link>
      </main>
    );
  }

  const { data: organizations, error } = await supabase.from('organizations').select('id, name');

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>GorFactory Collaboration Intelligence — Fase 1</h1>
      <p>
        Sesión iniciada como <strong>{user.email}</strong>
      </p>
      <SignOutButton />
      <p style={{ marginTop: 24 }}>
        <Link href="/intake">Ir a Intake &amp; Extraction →</Link>
      </p>
      <p style={{ marginTop: 24 }}>Organizaciones visibles (respeta la RLS de tu sesión):</p>
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
