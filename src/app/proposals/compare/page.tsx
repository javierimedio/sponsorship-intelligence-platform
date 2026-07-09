// src/app/proposals/compare/page.tsx
// "Compare Mode" — sin tabla nueva ni motor nuevo: reutiliza las mismas consultas que ya
// usa el listado y la ficha, aplicadas a varias propuestas a la vez.

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { getWorkspaceStage } from '@/lib/workspace-stage';

interface PageProps {
  searchParams: { ids?: string };
}

export default async function ComparePage({ searchParams }: PageProps) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return (
      <AppShell>
        <p>No has iniciado sesión.</p>
      </AppShell>
    );
  }

  const ids = (searchParams.ids ?? '').split(',').filter(Boolean);
  if (ids.length < 2) {
    return (
      <AppShell>
        <p>Selecciona al menos 2 propuestas desde el listado para compararlas.</p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </AppShell>
    );
  }

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, total_score, overall_risk_level, recommendation, submitted_at, approved_at, rejected_at, finalized_at, brand_id, brands(name), proposal_financials(estimated_amount, economic_concepts(nature))')
    .in('id', ids);

  const { data: orgProposals } = await supabase
    .from('proposals')
    .select('total_score')
    .eq('organization_id', profile.organizationId)
    .not('total_score', 'is', null);

  const allScores = (orgProposals ?? []).map((p: any) => Number(p.total_score));

  const rows = (proposals ?? []).map((p: any) => {
    const cost = (p.proposal_financials ?? [])
      .filter((f: any) => f.economic_concepts?.nature === 'cost' && f.estimated_amount !== null)
      .reduce((s: number, f: any) => s + Number(f.estimated_amount), 0);
    const result = (p.proposal_financials ?? [])
      .filter((f: any) => f.economic_concepts?.nature === 'result' && f.estimated_amount !== null)
      .reduce((s: number, f: any) => s + Number(f.estimated_amount), 0);
    const roi = cost > 0 ? result / cost : null;
    const percentile =
      p.total_score !== null && allScores.length
        ? Math.round((allScores.filter((s) => s <= p.total_score).length / allScores.length) * 100)
        : null;
    return { ...p, roi, percentile };
  });

  return (
    <AppShell>
      <p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </p>
      <h1>Comparar propuestas</h1>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th></th>
              {rows.map((r) => (
                <th key={r.id}>
                  <Link href={`/proposals/${r.id}`}>{r.title}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Marca</td>
              {rows.map((r) => <td key={r.id}>{r.brands?.name ?? 'Corporativo'}</td>)}
            </tr>
            <tr>
              <td>Score</td>
              {rows.map((r) => <td key={r.id}><ScoreBadge totalScore={r.total_score} /></td>)}
            </tr>
            <tr>
              <td>Riesgo</td>
              {rows.map((r) => <td key={r.id}><RiskBadge level={r.overall_risk_level} /></td>)}
            </tr>
            <tr>
              <td>ROI</td>
              {rows.map((r) => <td key={r.id}>{r.roi !== null ? `${r.roi.toFixed(1)}x` : '—'}</td>)}
            </tr>
            <tr>
              <td>Benchmark (percentil)</td>
              {rows.map((r) => <td key={r.id}>{r.percentile !== null ? r.percentile : '—'}</td>)}
            </tr>
            <tr>
              <td>Recomendación</td>
              {rows.map((r) => <td key={r.id}>{r.recommendation ?? '—'}</td>)}
            </tr>
            <tr>
              <td>Estado</td>
              {rows.map((r) => <td key={r.id}><StatusPill stage={getWorkspaceStage(r)} /></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
