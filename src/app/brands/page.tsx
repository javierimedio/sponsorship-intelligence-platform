// src/app/brands/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

export default async function BrandsPage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return (
      <AppShell>
        <p>No has iniciado sesión.</p>
      </AppShell>
    );
  }

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, brand_ai_context(positioning)')
    .eq('organization_id', profile.organizationId)
    .order('name');

  return (
    <AppShell>
      <h1>Marcas</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <p style={{ color: 'var(--c-mid)', margin: 0 }}>
          Recomendación estratégica de qué patrocinios/colaboraciones buscar para cada marca.
        </p>
        <Link href="/brands/new" className="btn btn-amber">
          + Nueva marca
        </Link>
      </div>

      <div className="kpi-grid">
        {(brands ?? []).map((b: any) => (
          <Link key={b.id} href={`/brands/${b.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="kpi-label" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{b.name}</div>
            <p style={{ fontSize: 12, color: 'var(--c-mid)', margin: 0 }}>
              {b.brand_ai_context?.positioning ?? 'Sin contexto de marca configurado todavía.'}
            </p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
