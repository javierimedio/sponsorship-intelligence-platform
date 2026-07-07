// src/app/proposals/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

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
    .select('id, title, status, total_score, overall_risk_level, recommendation, created_at')
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
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Score</th>
                <th>Riesgo</th>
                <th>Recomendación</th>
                <th>Creada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                  </td>
                  <td>
                    <span className={`status s-${p.status}`}>{p.status}</span>
                  </td>
                  <td>{p.total_score !== null ? `${(Number(p.total_score) * 100).toFixed(0)}%` : '—'}</td>
                  <td>{p.overall_risk_level ?? '—'}</td>
                  <td>
                    {p.recommendation ? (
                      <span style={{ color: RECOMMENDATION_COLOR[p.recommendation] ?? 'inherit', fontWeight: 700 }}>
                        {p.recommendation}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ color: 'var(--c-mid)', fontSize: 12 }}>
                    {new Date(p.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td>
                    <Link href={`/proposals/${p.id}`}>Ver →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
