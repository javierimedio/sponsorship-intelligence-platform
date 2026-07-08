// src/app/proposals/page.tsx
// Listado rediseñado (Documento 6 + petición explícita de Fase A): filas, no tabla densa.
// ConfidenceRing + badges dan toda la información de un vistazo, sin abrir nada.

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ConfidenceRing } from '@/components/confidence-ring';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { getWorkspaceStage } from '@/lib/workspace-stage';

const RECOMMENDATION_COLOR: Record<string, string> = {
  Recomendable: 'var(--c-green)',
  Táctico: 'var(--c-amber)',
  'No recomendable': 'var(--c-red)',
};

export default async function ProposalsPage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return (
      <AppShell>
        <p>No has iniciado sesión o tu usuario no tiene perfil de negocio asignado.</p>
      </AppShell>
    );
  }

  const { data: proposals, error } = await supabase
    .from('proposals')
    .select(
      'id, title, total_score, overall_risk_level, recommendation, created_at, submitted_at, ' +
        'approved_at, finalized_at, partner_name, brands(name)',
    )
    .order('created_at', { ascending: false });

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Propuestas</h1>
        <Link href="/intake" className="btn btn-amber">
          + Nueva propuesta
        </Link>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {error ? (
          <p style={{ padding: '1rem', color: 'crimson' }}>{error.message}</p>
        ) : !proposals?.length ? (
          <div className="empty-state">
            <p>
              Aún no hay ninguna propuesta.{' '}
              <Link href="/intake">Crea la primera →</Link>
            </p>
          </div>
        ) : (
          <div>
            {proposals.map((p: any) => (
              <Link key={p.id} href={`/proposals/${p.id}`} className="proposal-row">
                <ConfidenceRing totalScore={p.total_score} overallRiskLevel={p.overall_risk_level} size="sm" />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="proposal-title">{p.title}</div>
                  <div className="proposal-meta">
                    {p.brands?.name ?? 'Corporativo'}
                    {p.partner_name ? ` · ${p.partner_name}` : ''} ·{' '}
                    {new Date(p.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>

                <ScoreBadge totalScore={p.total_score} />
                <RiskBadge level={p.overall_risk_level} />
                <StatusPill stage={getWorkspaceStage(p)} />

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: p.recommendation ? RECOMMENDATION_COLOR[p.recommendation] ?? 'inherit' : 'var(--c-mid)',
                    minWidth: 110,
                    textAlign: 'right',
                  }}
                >
                  {p.recommendation ?? '—'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
