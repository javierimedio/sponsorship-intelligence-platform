// src/app/proposals/[id]/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';

interface PageProps {
  params: { id: string };
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: proposal } = await supabase.from('proposals').select('*').eq('id', params.id).maybeSingle();

  if (!proposal) {
    return (
      <AppShell>
        <p>Propuesta no encontrada (o no tienes acceso desde tu organización).</p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </AppShell>
    );
  }

  const [{ data: extraction }, { data: scores }, { data: risks }, { data: financials }] = await Promise.all([
    supabase
      .from('ai_extractions')
      .select('extracted_json, model_used, created_at')
      .eq('proposal_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('proposal_scores')
      .select('score_value, ai_rationale, source, scoring_attributes(name, max_score, scoring_blocks(name))')
      .eq('proposal_id', params.id),
    supabase
      .from('proposal_risks')
      .select('level, impact, computed_score, source, risk_factors(name, risk_blocks(name))')
      .eq('proposal_id', params.id),
    supabase
      .from('proposal_financials')
      .select('estimated_amount, source, economic_concepts(name, nature)')
      .eq('proposal_id', params.id),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractedJson = (extraction?.extracted_json ?? {}) as Record<string, any>;

  return (
    <AppShell>
      <p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>{proposal.title}</h1>
      <p style={{ color: 'var(--c-mid)', marginTop: 0, marginBottom: 24 }}>
        Estado: <span className={`status s-${proposal.status}`}>{proposal.status}</span>
      </p>

      <div className="card">
        <div className="card-title">Resultado de la evaluación</div>
        <div className="stat-block">
          <div>
            <div className="stat-label">Score total</div>
            <div className="stat-value">
              {proposal.total_score !== null ? `${(Number(proposal.total_score) * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="stat-label">Riesgo global</div>
            <div className="stat-value">{proposal.overall_risk_level ?? '—'}</div>
          </div>
          <div>
            <div className="stat-label">Recomendación</div>
            <div className="stat-value">{proposal.recommendation ?? '—'}</div>
          </div>
        </div>
      </div>

      {extraction && (
        <div className="card">
          <div className="card-title">Extracción ({extraction.model_used})</div>
          <p>
            <strong>Solicitante:</strong> {extractedJson.requester_name ?? '—'} ({extractedJson.requester_org ?? '—'})
          </p>
          <p>
            <strong>Tipo de colaboración:</strong> {extractedJson.collaboration_type ?? '—'}
          </p>
          <p>
            <strong>Resumen:</strong> {extractedJson.summary ?? '—'}
          </p>
          <p>
            <strong>Importe estimado:</strong> {extractedJson.estimated_total_amount ?? '—'}{' '}
            {extractedJson.currency ?? ''}
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Scoring por atributo</div>
        <table>
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Atributo</th>
              <th>Puntuación</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {(scores ?? []).map((s: any, i: number) => (
              <tr key={i}>
                <td>{s.scoring_attributes?.scoring_blocks?.name}</td>
                <td>{s.scoring_attributes?.name}</td>
                <td>
                  {Number(s.score_value).toFixed(3)} / {s.scoring_attributes?.max_score}
                </td>
                <td>{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Factores de riesgo</div>
        <table>
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Factor</th>
              <th>Nivel</th>
              <th>Impacto</th>
              <th>Puntuación</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {(risks ?? []).map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.risk_factors?.risk_blocks?.name}</td>
                <td>{r.risk_factors?.name}</td>
                <td>{r.level}</td>
                <td>{r.impact}</td>
                <td>{r.computed_score}</td>
                <td>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Líneas financieras</div>
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Naturaleza</th>
              <th>Importe</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {(financials ?? []).map((f: any, i: number) => (
              <tr key={i}>
                <td>{f.economic_concepts?.name}</td>
                <td>{f.economic_concepts?.nature === 'cost' ? 'Coste' : 'Resultado'}</td>
                <td>{f.estimated_amount !== null ? `${Number(f.estimated_amount).toLocaleString('es-ES')} €` : '—'}</td>
                <td>{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
