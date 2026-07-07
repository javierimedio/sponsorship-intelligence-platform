// src/app/intake/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { IntakeForm } from './intake-form';

export default async function IntakePage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  const manualMode = (process.env.AI_PROVIDER ?? '').toLowerCase() === 'manual';

  if (!profile) {
    return (
      <main style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
        <h1>Intake &amp; Extraction</h1>
        <p>No has iniciado sesión o tu usuario no tiene perfil de negocio asignado.</p>
        <Link href="/login">Iniciar sesión</Link>
      </main>
    );
  }

  return (
    <AppShell>
      <h1>Nueva propuesta</h1>
      {manualMode ? (
        <p style={{ color: 'var(--c-mid)' }}>
          <strong>Modo manual activo</strong> (AI_PROVIDER=manual): tú introduces los mismos datos
          que rellenaría un Agente de IA. El motor de scoring/riesgo/recomendación es idéntico —
          solo cambia de dónde vienen los números de entrada. Se guarda como{' '}
          <code>source=&quot;manual&quot;</code>.
        </p>
      ) : (
        <p style={{ color: 'var(--c-mid)' }}>
          Crea una propuesta, sube un documento y el sistema encadena automáticamente:
          Agente 1 (extracción) → Agentes 2/3/5 (scoring, riesgo y financials, en paralelo) →
          recomendación determinista.
        </p>
      )}
      <div className="card">
        <IntakeForm organizationId={profile.organizationId} manualMode={manualMode} />
      </div>
    </AppShell>
  );
}
