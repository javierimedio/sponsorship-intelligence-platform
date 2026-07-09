// src/app/proposals/[id]/versions/page.tsx
// "Historial de versiones" — lista las evaluaciones archivadas (proposal_evaluation_versions)
// y permite comparar cualquiera de ellas contra el estado actual. No toca ninguna tabla
// "en vivo" — es puramente de lectura sobre lo que evaluation-repository.ts ya archiva.

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

interface PageProps {
  params: { id: string };
  searchParams: { compare?: string };
}

export default async function VersionsPage({ params, searchParams }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, total_score, overall_risk_level, recommendation, updated_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!proposal) {
    return (
      <AppShell>
        <p>Propuesta no encontrada.</p>
      </AppShell>
    );
  }

  const { data: versions } = await supabase
    .from('proposal_evaluation_versions')
    .select('version, total_score, overall_risk_level, recommendation, archived_at')
    .eq('proposal_id', params.id)
    .order('version', { ascending: true });

  const compareVersion = searchParams.compare ? Number(searchParams.compare) : null;

  let diff: {
    oldScores: any[];
    newScores: any[];
    oldRisks: any[];
    newRisks: any[];
    oldFinancials: any[];
    newFinancials: any[];
  } | null = null;

  if (compareVersion) {
    const [{ data: oldScores }, { data: newScores }, { data: oldRisks }, { data: newRisks }, { data: oldFinancials }, { data: newFinancials }] =
      await Promise.all([
        supabase
          .from('proposal_scores_history')
          .select('scoring_attribute_id, score_value, scoring_attributes(name, max_score)')
          .eq('proposal_id', params.id)
          .eq('version', compareVersion),
        supabase.from('proposal_scores').select('scoring_attribute_id, score_value, scoring_attributes(name, max_score)').eq('proposal_id', params.id),
        supabase
          .from('proposal_risks_history')
          .select('risk_factor_id, level, impact, risk_factors(name)')
          .eq('proposal_id', params.id)
          .eq('version', compareVersion),
        supabase.from('proposal_risks').select('risk_factor_id, level, impact, risk_factors(name)').eq('proposal_id', params.id),
        supabase
          .from('proposal_financials_history')
          .select('economic_concept_id, estimated_amount, economic_concepts(name)')
          .eq('proposal_id', params.id)
          .eq('version', compareVersion),
        supabase.from('proposal_financials').select('economic_concept_id, estimated_amount, economic_concepts(name)').eq('proposal_id', params.id),
      ]);

    diff = {
      oldScores: oldScores ?? [],
      newScores: newScores ?? [],
      oldRisks: oldRisks ?? [],
      newRisks: newRisks ?? [],
      oldFinancials: oldFinancials ?? [],
      newFinancials: newFinancials ?? [],
    };
  }

  return (
    <AppShell>
      <p>
        <Link href={`/proposals/${params.id}`}>← Volver a la ficha</Link>
      </p>
      <h1>Historial de versiones</h1>
      <p style={{ color: 'var(--c-mid)' }}>{proposal.title}</p>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Versión</th>
              <th>Fecha</th>
              <th>Score</th>
              <th>Riesgo</th>
              <th>Recomendación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(versions ?? []).map((v) => (
              <tr key={v.version}>
                <td>v{v.version}</td>
                <td style={{ fontSize: 12 }}>{new Date(v.archived_at).toLocaleString('es-ES')}</td>
                <td>{v.total_score !== null ? `${Math.round(v.total_score * 100)}%` : '—'}</td>
                <td>{v.overall_risk_level ?? '—'}</td>
                <td>{v.recommendation ?? '—'}</td>
                <td>
                  <Link href={`/proposals/${params.id}/versions?compare=${v.version}`}>Comparar con actual →</Link>
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--c-light)' }}>
              <td>
                <strong>Actual</strong>
              </td>
              <td style={{ fontSize: 12 }}>{new Date(proposal.updated_at).toLocaleString('es-ES')}</td>
              <td>{proposal.total_score !== null ? `${Math.round(proposal.total_score * 100)}%` : '—'}</td>
              <td>{proposal.overall_risk_level ?? '—'}</td>
              <td>{proposal.recommendation ?? '—'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {!versions?.length && (
        <p style={{ color: 'var(--c-mid)', fontSize: 13 }}>
          Esta propuesta solo tiene una evaluación — todavía no hay versiones anteriores que comparar. En cuanto la
          reevalúes (editándola de nuevo), la evaluación actual quedará archivada como v1.
        </p>
      )}

      {diff && (
        <div className="card">
          <div className="card-title">Comparando v{compareVersion} → Actual</div>

          <h3 style={{ fontSize: 14 }}>Scoring</h3>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Atributo</th>
                <th>v{compareVersion}</th>
                <th>Actual</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {diff.newScores.map((n: any) => {
                const old = diff!.oldScores.find((o: any) => o.scoring_attribute_id === n.scoring_attribute_id);
                const delta = Number(n.score_value) - Number(old?.score_value ?? 0);
                return (
                  <tr key={n.scoring_attribute_id}>
                    <td>{n.scoring_attributes?.name}</td>
                    <td>{old ? Number(old.score_value).toFixed(2) : '—'}</td>
                    <td>{Number(n.score_value).toFixed(2)}</td>
                    <td style={{ color: delta > 0 ? 'var(--c-green)' : delta < 0 ? 'var(--c-red)' : 'var(--c-mid)', fontWeight: 700 }}>
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ fontSize: 14 }}>Riesgo</h3>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Factor</th>
                <th>v{compareVersion}</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {diff.newRisks.map((n: any) => {
                const old = diff!.oldRisks.find((o: any) => o.risk_factor_id === n.risk_factor_id);
                return (
                  <tr key={n.risk_factor_id}>
                    <td>{n.risk_factors?.name}</td>
                    <td>{old ? `${old.level} / ${old.impact}` : '—'}</td>
                    <td>
                      {n.level} / {n.impact}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ fontSize: 14 }}>Financials</h3>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>v{compareVersion}</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {diff.newFinancials.map((n: any) => {
                const old = diff!.oldFinancials.find((o: any) => o.economic_concept_id === n.economic_concept_id);
                return (
                  <tr key={n.economic_concept_id}>
                    <td>{n.economic_concepts?.name}</td>
                    <td>{old?.estimated_amount != null ? `${Number(old.estimated_amount).toLocaleString('es-ES')} €` : '—'}</td>
                    <td>{n.estimated_amount != null ? `${Number(n.estimated_amount).toLocaleString('es-ES')} €` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
