// src/app/intake/page.tsx

import Link from 'next/link';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { IntakeForm } from './intake-form';

export default async function IntakePage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return (
      <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h1>Intake &amp; Extraction</h1>
        <p>No has iniciado sesión o tu usuario no tiene perfil de negocio asignado.</p>
        <Link href="/login">Iniciar sesión</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 560 }}>
      <h1>Intake &amp; Extraction — Evaluation — Fase 1</h1>
      <p style={{ color: '#666' }}>
        Crea una propuesta, sube un documento y el sistema encadena automáticamente:
        Agente 1 (extracción con Claude) → Agentes 2/3/5 (scoring, riesgo y financials, en
        paralelo) → recomendación determinista. El archivo se sube directamente a Supabase
        Storage (protegido por RLS a tu organización); solo los metadatos y el resultado
        pasan por nuestra API.
      </p>
      <IntakeForm organizationId={profile.organizationId} />
      <p style={{ marginTop: 24 }}>
        <Link href="/">← Volver</Link>
      </p>
    </main>
  );
}
