// src/app/proposals/[id]/print/page.tsx
// "Executive Export" — sin librería de generación de PDF: es una vista limpia optimizada
// para impresión (@media print en globals.css) + el diálogo nativo "Guardar como PDF" del
// navegador. Cero dependencias nuevas, cero coste, funciona en cualquier navegador.

import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { generateStrengthsAndWeaknesses } from '@/lib/executive-summary';
import { PrintTrigger } from './print-trigger';

interface PageProps {
  params: { id: string };
}

export default async function ExecutiveReportPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: proposal } = await supabase.from('proposals').select('*, brands(name)').eq('id', params.id).maybeSingle();
  if (!proposal) return <p style={{ padding: 40 }}>Propuesta no encontrada.</p>;

  const [{ data: scores }, { data: risks }, { data: financials }, { data: activations }, { data: orgProposals }] = await Promise.all([
    supabase
      .from('proposal_scores')
      .select('score_value, scoring_attributes(name, max_score, scoring_blocks(name))')
      .eq('proposal_id', params.id),
    supabase.from('proposal_risks').select('level, impact, computed_score, risk_factors(name, risk_blocks(name))').eq('proposal_id', params.id),
    supabase.from('proposal_financials').select('estimated_amount, economic_concepts(name, nature)').eq('proposal_id', params.id),
    supabase
      .from('proposal_activations')
      .select('priority, activation_catalog_items(area, name)')
      .eq('proposal_id', params.id),
    supabase.from('proposals').select('total_score').eq('organization_id', proposal.organization_id).not('total_score', 'is', null),
  ]);

  const { strengths, weaknesses } = generateStrengthsAndWeaknesses(scores ?? []);

  const totalCost = (financials ?? [])
    .filter((f: any) => f.economic_concepts?.nature === 'cost' && f.estimated_amount !== null)
    .reduce((s: number, f: any) => s + Number(f.estimated_amount), 0);
  const totalResult = (financials ?? [])
    .filter((f: any) => f.economic_concepts?.nature === 'result' && f.estimated_amount !== null)
    .reduce((s: number, f: any) => s + Number(f.estimated_amount), 0);
  const roi = totalCost > 0 ? totalResult / totalCost : null;

  const otherScores = (orgProposals ?? []).map((p: any) => Number(p.total_score));
  const percentile =
    proposal.total_score !== null && otherScores.length > 0
      ? Math.round((otherScores.filter((s) => s <= proposal.total_score!).length / otherScores.length) * 100)
      : null;

  return (
    <div className="print-page">
      <PrintTrigger />

      {/* ── PÁGINA 1 ── */}
      <section className="print-sheet">
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>Executive Report</div>
          <h1 style={{ margin: '4px 0' }}>{proposal.title}</h1>
          <div style={{ fontSize: 13, color: '#555' }}>
            {(proposal as any).brands?.name ?? 'Corporativo'}
            {proposal.partner_name ? ` · ${proposal.partner_name}` : ''} · {new Date().toLocaleDateString('es-ES')}
          </div>
        </header>

        <div style={{ display: 'flex', gap: 32, marginBottom: 28 }}>
          <Stat label="Score" value={proposal.total_score !== null ? `${Math.round(proposal.total_score * 100)}%` : '—'} />
          <Stat label="Riesgo" value={proposal.overall_risk_level ?? '—'} />
          <Stat
            label="ROI"
            value={roi !== null ? `${roi.toFixed(1)}x` : '—'}
            caption={roi !== null ? `${roi.toFixed(2)}€ de retorno por cada 1€ invertido` : undefined}
          />
          <Stat label="Recomendación" value={proposal.recommendation ?? '—'} />
        </div>

        <h3>Resumen financiero</h3>
        <table className="print-table">
          <tbody>
            <tr><td>Coste total</td><td>{totalCost.toLocaleString('es-ES')} €</td></tr>
            <tr><td>Retorno esperado</td><td>{totalResult.toLocaleString('es-ES')} €</td></tr>
          </tbody>
        </table>

        <h3>Benchmark interno</h3>
        <p>
          {percentile !== null
            ? `Esta propuesta se sitúa en el percentil ${percentile} sobre ${otherScores.length} propuesta(s) evaluada(s) en la organización.`
            : 'Sin datos suficientes de histórico todavía.'}
        </p>
      </section>

      {/* ── PÁGINA 2 ── */}
      <section className="print-sheet print-page-break">
        <h2>Fortalezas y debilidades</h2>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <h3>Fortalezas</h3>
            <ul>{strengths.length ? strengths.map((s, i) => <li key={i}>{s}</li>) : <li>Ninguna destaca especialmente.</li>}</ul>
          </div>
          <div style={{ flex: 1 }}>
            <h3>Debilidades</h3>
            <ul>{weaknesses.length ? weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>Ninguna especialmente débil.</li>}</ul>
          </div>
        </div>

        <h3>Factores de riesgo</h3>
        <table className="print-table">
          <thead><tr><th>Factor</th><th>Nivel</th><th>Impacto</th></tr></thead>
          <tbody>
            {(risks ?? []).map((r: any, i: number) => (
              <tr key={i}><td>{r.risk_factors?.name}</td><td>{r.level}</td><td>{r.impact}</td></tr>
            ))}
          </tbody>
        </table>

        <h3>Plan de activación</h3>
        <table className="print-table">
          <thead><tr><th>Acción</th><th>Prioridad</th></tr></thead>
          <tbody>
            {!activations?.length ? (
              <tr><td colSpan={2}>Sin plan de activación definido.</td></tr>
            ) : (
              activations.map((a: any, i: number) => (
                <tr key={i}><td>{a.activation_catalog_items?.area} — {a.activation_catalog_items?.name}</td><td>{a.priority ?? '—'}</td></tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#888' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {caption && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{caption}</div>}
    </div>
  );
}
