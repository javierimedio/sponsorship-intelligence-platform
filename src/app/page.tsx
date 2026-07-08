import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import Dashboard from '@/components/dashboard/dashboard';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

export default async function HomePage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
        <h1>GorFactory Collaboration Intelligence</h1>

        <p>No has iniciado sesión.</p>

        <Link href="/login">
          Iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
