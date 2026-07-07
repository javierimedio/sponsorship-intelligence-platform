// src/app/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
        <h1>GorFactory Collaboration Intelligence — Fase 1</h1>
        <p>No has iniciado sesión.</p>
        <Link href="/login">Iniciar sesión</Link>
      </main>
    );
  }

  const { data: organizations, error } = await supabase.from('organizations').select('id, name');

  return (
    <AppShell>
      <h1>Bienvenido</h1>
      <p style={{ color: 'var(--c-mid)', marginTop: 0 }}>
        Sesión iniciada como <strong>{user.email}</strong>
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 24, marginBottom: 24 }}>
        <Link href="/proposals" className="card" style={{ flex: 1, textDecoration: 'none', display: 'block' }}>
          <div className="card-title">Propuestas</div>
          <p style={{ margin: 0, color: 'var(--c-dark)' }}>Ver todas las propuestas registradas y su evaluación.</p>
        </Link>
        <Link href="/intake" className="card" style={{ flex: 1, textDecoration: 'none', display: 'block' }}>
          <div className="card-title">Nueva propuesta</div>
          <p style={{ margin: 0, color: 'var(--c-dark)' }}>Crear, extraer y evaluar una propuesta de colaboración.</p>
        </Link>
      </div>

      <div className="card">
        <div className="card-title">Organizaciones visibles (respeta la RLS de tu sesión)</div>
        {error ? (
          <p style={{ color: 'crimson' }}>{error.message}</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(organizations ?? []).map((org) => (
              <li key={org.id}>{org.name}</li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
