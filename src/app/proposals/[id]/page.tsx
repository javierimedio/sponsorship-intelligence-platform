// src/app/proposals/[id]/page.tsx
// El Workspace adaptativo (Documento 6) — sustituye la antigua "ficha" plana de cards.
// Header + ConfidenceRing + DecisionStrip + Nivel 1 (cambia según el estado) + Nivel 2
// (acordeones, detalle técnico) + panel derecho (IA + documentos). Reutiliza el motor de
// datos existente sin tocarlo — esto es 100% reorganización de presentación.

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { AppShell } from '@/components/app-shell';
import { ConfidenceRing } from '@/components/confidence-ring';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
import { DecisionStrip } from '@/components/decision-strip';
import { AIInsightPanel } from '@/components/ai-insight-panel';
import { InlineEditable } from '@/components/inline-editable';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getTone, getWorkspaceStage } from '@/lib/workspace-stage';
import { LifecycleActions } from './lifecycle-actions';
import { ActivationFollowUp } from './activation-followup';

interface PageProps {
  params: { id: string };
}

const REQUIRED_EXTRACTION_FIELDS: { key: string; label: string }[] = [
  { key: 'requester_name', label: 'Solicitante' },
  { key: 'requester_org', label: 'Organización solicitante' },
  { key: 'collaboration_type', label: 'Tipo de colaboración' },
  { key: 'estimated_total_amount', label: 'Importe estimado' },
];

export default async function ProposalWorkspacePage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: proposal } = await supabase.from('proposals').select('*, brands(name)').eq('id', params.id).maybeSingle();

  if (!proposal) {
    return (
      <AppShell>
        <p>Propuesta no encontrada (o no tienes acceso desde tu organización).</p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </AppShell>
    );
  }

  const [
    { data: documents },
    { data: extraction },
    { data: scores },
    { data: risks },
    { data: financials },
    { data: activations },
  ] = await Promise.all([
    supabase.from('documents').select('id, original_filename, storage_path, uploaded_at').eq('proposal_id', params.id),
    supabase
      .from('ai_extractions')
      .select('extracted_json, model_used')
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
      .select('estimated_amount, source, economic_concepts(name, nature, block_type)')
      .eq('proposal_id', params.id),
    supabase
      .from('proposal_activations')
      .select(
        'id, notes, source, status, priority, expected_impact, effort, responsible, start_date, end_date, ' +
          'kpi_target, kpi_result, is_reusable, useful_life, ' +
          'activation_catalog_items(area, name), channels(name), kpi_definitions(name)',
      )
      .eq('proposal_id', params.id),
  ]);

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractedJson = (extraction?.extracted_json ?? null) as Record<string, any> | null;

  const stage = getWorkspaceStage(proposal);
  const tone = getTone({ totalScore: proposal.total_score, overallRiskLevel: proposal.overall_risk_level });

  const missingFields = REQUIRED_EXTRACTION_FIELDS.filter(
    (f) => !extractedJson || extractedJson[f.key] === null || extractedJson[f.key] === undefined || extractedJson[f.key] === '',
  );

  const pendingActivations = (activations ?? []).filter((a: any) => a.status !== 'done' && a.status !== 'cancelled');

  const totalCost = (financials ?? [])
    .filter((f: any) => f.economic_concepts?.nature === 'cost' && f.estimated_amount !== null)
    .reduce((sum: number, f: any) => sum + Number(f.estimated_amount), 0);
  const totalResult = (financials ?? [])
    .filter((f: any) => f.economic_concepts?.nature === 'result' && f.estimated_amount !== null)
    .reduce((sum: number, f: any) => sum + Number(f.estimated_amount), 0);
  const roi = totalCost > 0 ? totalResult / totalCost : null;

  async function updateTitle(newTitle: string) {
    'use server';
    const client = createSupabaseServerClient();
    await client.from('proposals').update({ title: newTitle }).eq('id', params.id);
    revalidatePath(`/proposals/${params.id}`);
  }

  return (
    <AppShell>
      <p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </p>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <ConfidenceRing totalScore={proposal.total_score} overallRiskLevel={proposal.overall_risk_level} size="lg" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>
              {stage === 'draft' ? (
                <InlineEditable value={proposal.title} onSave={updateTitle} fontSize={22} fontWeight={700} />
              ) : (
                proposal.title
              )}
            </h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusPill stage={stage} />
              <ScoreBadge totalScore={proposal.total_score} />
              <RiskBadge level={proposal.overall_risk_level} />
              <span style={{ fontSize: 12, color: 'var(--c-mid)', alignSelf: 'center' }}>
                {(proposal as any).brands?.name ?? 'Corporativo'}
                {proposal.partner_name ? ` · ${proposal.partner_name}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stage === 'draft' && (
            <Link href={`/proposals/${proposal.id}/edit`} className="btn btn-outline">
              ✏️ Editar
            </Link>
          )}
          <LifecycleActions
            proposalId={proposal.id}
            hasRecommendation={Boolean(proposal.recommendation)}
            submittedAt={proposal.submitted_at}
            approvedAt={proposal.approved_at}
            finalizedAt={proposal.finalized_at}
          />
        </div>
      </div>

      {/* ── DECISION STRIP — mismo componente, contenido distinto según el estado ── */}
      <DecisionStrip
        stage={stage}
        tone={tone}
        proposalId={proposal.id}
        totalScore={proposal.total_score}
        overallRiskLevel={proposal.overall_risk_level}
        recommendation={proposal.recommendation}
        pendingActivationsCount={pendingActivations.length}
        missingFieldsCount={missingFields.length}
      />

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* ── ZONA CENTRAL: NIVEL 1 (adaptativo) + NIVEL 2 (detalle) ── */}
        <div style={{ flex: 2, minWidth: 0 }}>
          {/* NIVEL 1 */}
          {stage === 'draft' && (
            <div className="card">
              <div className="card-title">¿Qué falta para poder evaluar?</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 14 }}>
                {REQUIRED_EXTRACTION_FIELDS.map((f) => {
                  const done = extractedJson && extractedJson[f.key] !== null && extractedJson[f.key] !== undefined && extractedJson[f.key] !== '';
                  return (
                    <li key={f.key} style={{ padding: '6px 0', color: done ? 'var(--c-green)' : 'var(--c-mid)' }}>
                      {done ? '✓' : '✗'} {f.label}
                    </li>
                  );
                })}
                <li style={{ padding: '6px 0', color: documentsWithUrls.length ? 'var(--c-green)' : 'var(--c-mid)' }}>
                  {documentsWithUrls.length ? '✓' : '✗'} Documento adjunto ({documentsWithUrls.length})
                </li>
              </ul>
            </div>
          )}

          {stage === 'evaluated' && (
            <div className="card">
              <div className="card-title">Resumen de la evaluación</div>
              <div className="stat-block" style={{ marginBottom: 12 }}>
                <div>
                  <div className="stat-label">Coste total</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{totalCost.toLocaleString('es-ES')} €</div>
                </div>
                <div>
                  <div className="stat-label">Retorno esperado</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{totalResult.toLocaleString('es-ES')} €</div>
                </div>
                <div>
                  <div className="stat-label">ROI estimado</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{roi !== null ? `${roi.toFixed(1)}x` : '—'}</div>
                </div>
              </div>
            </div>
          )}

          {stage === 'approved' && (
            <div className="card">
              <div className="card-title">Próximas activaciones ({pendingActivations.length} pendientes)</div>
              {!pendingActivations.length ? (
                <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Todo ejecutado — sin acciones pendientes.</p>
              ) : (
                <ul className="mini-list">
                  {pendingActivations.slice(0, 5).map((a: any) => (
                    <li key={a.id}>
                      <span>
                        {a.activation_catalog_items?.area} — {a.activation_catalog_items?.name}
                        {a.responsible ? ` · ${a.responsible}` : ''}
                      </span>
                      <span style={{ color: 'var(--c-mid)' }}>{a.start_date ?? 'sin fecha'}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ fontSize: 12, color: 'var(--c-mid)', marginTop: 12, marginBottom: 0 }}>
                Coste comprometido: {totalCost.toLocaleString('es-ES')} €
              </p>
            </div>
          )}

          {stage === 'finalized' && (
            <div className="card">
              <div className="card-title">Resultado final</div>
              <div className="stat-block" style={{ marginBottom: 12 }}>
                <div>
                  <div className="stat-label">Score de evaluación</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>
                    {proposal.total_score !== null ? `${Math.round(proposal.total_score * 100)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="stat-label">ROI estimado</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{roi !== null ? `${roi.toFixed(1)}x` : '—'}</div>
                </div>
              </div>
              <div className="card-title" style={{ marginTop: 8 }}>KPI: objetivo vs. resultado</div>
              {!activations?.some((a: any) => a.kpi_target) ? (
                <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Sin KPIs de activación registrados.</p>
              ) : (
                <ul className="mini-list">
                  {(activations ?? [])
                    .filter((a: any) => a.kpi_target)
                    .map((a: any) => (
                      <li key={a.id}>
                        <span>{a.kpi_definitions?.name ?? 'KPI'}</span>
                        <span>
                          {a.kpi_target} → <strong>{a.kpi_result ?? 'sin resultado'}</strong>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          {/* NIVEL 2 — detalle técnico, un clic de distancia */}
          <details className="level-2">
            <summary>Ver desglose de Evaluación ({scores?.length ?? 0} atributos)</summary>
            <div className="level-2-body">
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
          </details>

          <details className="level-2">
            <summary>Ver matriz de riesgo ({risks?.length ?? 0} factores)</summary>
            <div className="level-2-body">
              <table>
                <thead>
                  <tr>
                    <th>Bloque</th>
                    <th>Factor</th>
                    <th>Nivel</th>
                    <th>Impacto</th>
                    <th>Puntuación</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details className="level-2">
            <summary>Ver Costes-ROI ({financials?.length ?? 0} conceptos)</summary>
            <div className="level-2-body">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Bloque</th>
                    <th>Naturaleza</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(financials ?? []).map((f: any, i: number) => (
                    <tr key={i}>
                      <td>{f.economic_concepts?.name}</td>
                      <td>{f.economic_concepts?.block_type ?? '—'}</td>
                      <td>{f.economic_concepts?.nature === 'cost' ? 'Coste' : 'Resultado'}</td>
                      <td>{f.estimated_amount !== null ? `${Number(f.estimated_amount).toLocaleString('es-ES')} €` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details className="level-2">
            <summary>Ver plan de activación completo ({activations?.length ?? 0} acciones)</summary>
            <div className="level-2-body" style={{ overflowX: 'auto' }}>
              {!activations?.length ? (
                <p style={{ color: 'var(--c-mid)', margin: 0 }}>Sin plan de activación definido.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th>Canal</th>
                      <th>Prioridad</th>
                      <th>Responsable</th>
                      <th>Fechas</th>
                      <th>KPI</th>
                      <th>Seguimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activations.map((a: any) => (
                      <tr key={a.id}>
                        <td>
                          {a.activation_catalog_items?.area} — {a.activation_catalog_items?.name}
                        </td>
                        <td>{a.channels?.name ?? '—'}</td>
                        <td>{a.priority ?? '—'}</td>
                        <td>{a.responsible ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {a.start_date ?? '—'} → {a.end_date ?? '—'}
                        </td>
                        <td>{a.kpi_definitions?.name ? `${a.kpi_definitions.name}: ${a.kpi_target ?? '—'}` : '—'}</td>
                        <td>
                          <ActivationFollowUp actionId={a.id} currentStatus={a.status} currentKpiResult={a.kpi_result} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>

          {/* NIVEL 3 — histórico, todavía sin construir (Fase D) */}
          <details className="level-2">
            <summary>Actividad e histórico</summary>
            <div className="level-2-body">
              <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>
                Próximamente: timeline de eventos, comentarios del equipo e histórico con este partner
                (Documento 5, Fase D — pendiente de desarrollo).
              </p>
            </div>
          </details>
        </div>

        {/* ── PANEL DERECHO ── */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <AIInsightPanel title="Análisis">
            {extractedJson?.summary ? (
              <>
                <p style={{ marginTop: 0 }}>{extractedJson.summary}</p>
                {proposal.recommendation && (
                  <p style={{ marginBottom: 0 }}>
                    <strong>{proposal.recommendation}</strong> — score{' '}
                    {proposal.total_score !== null ? Math.round(proposal.total_score * 100) : '—'}%, riesgo{' '}
                    {proposal.overall_risk_level ?? '—'}.
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0 }}>Todavía no hay extracción ni evaluación que interpretar.</p>
            )}
          </AIInsightPanel>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Documentos ({documentsWithUrls.length})</div>
            {!documentsWithUrls.length ? (
              <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Sin documentos adjuntos.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
                {documentsWithUrls.map((doc) => (
                  <li key={doc.id} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                      {doc.original_filename}
                    </span>
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        Descargar
                      </a>
                    ) : (
                      <span style={{ color: 'var(--c-mid)' }}>—</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
