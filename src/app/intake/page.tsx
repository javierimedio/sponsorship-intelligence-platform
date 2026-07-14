// src/app/intake/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { IntakeForm } from './intake-form';

export default async function IntakePage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  const defaultProvider = (process.env.AI_PROVIDER ?? 'manual').toLowerCase();

  if (!profile) {
    return (
      <main style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
        <h1>Intake &amp; Extraction</h1>
        <p>No has iniciado sesión o tu usuario no tiene perfil de negocio asignado.</p>
        <Link href="/login">Iniciar sesión</Link>
      </main>
    );
  }

  if (profile.appRole === 'viewer') {
    return (
      <AppShell>
        <h1>Nueva propuesta</h1>
        <p style={{ color: 'var(--c-mid)' }}>Tu rol (Visitante) no permite crear propuestas nuevas.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1>Nueva propuesta</h1>
      <p style={{ color: 'var(--c-mid)' }}>
        Crea una propuesta, sube un documento y elige cómo quieres extraer su información —
        a mano, o con un proveedor de IA configurado. La propuesta queda en{' '}
        <strong>Borrador</strong> hasta que la envíes explícitamente.
      </p>
      <div className="card">
        <IntakeForm organizationId={profile.organizationId} defaultProvider={defaultProvider} />
      </div>
    </AppShell>
  );
}
