// src/app/proposals/[id]/page.tsx
// Proposal Workspace — ronda de refinamiento sobre la Fase 2. Página única en scroll
// vertical. Cambios de esta ronda: Comentarios oculto (sin persistencia real todavía),
// Adjuntos categorizados por document_type, Timeline con iconos, Executive Summary
// desacoplado de su función generadora, Decision Strip enriquecido con acciones de
// ciclo de vida, resúmenes antes de las tablas de Activaciones/Financials/Riesgo,
// y Fortalezas/Debilidades al final de Evaluación.

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { AppShell } from '@/components/app-shell';
import { ConfidenceRing } from '@/components/confidence-ring';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
import { DecisionStrip } from '@/components/decision-strip';
import { InsightCard } from '@/components/insight-card';
import { EmptyState } from '@/components/empty-state';
import { InlineEditable } from '@/components/inline-editable';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { computeGlobalRiskScore, getTone, getWorkspaceStage } from '@/lib/workspace-stage';
import { generateExecutiveSummary, generateStrengthsAndWeaknesses } from '@/lib/executive-summary';
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

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  original: 'PDF original recibido',
  email: 'Email asociado',
  ai_generated: 'Archivos generados por IA',
  image: 'Imágenes',
  dossier: 'Dossier',
  other: 'Otros',
};
const DOCUMENT_TYPE_ORDER = ['original', 'dossier', 'email', 'image', 'ai_generated', 'other'];

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
    { data: extractionHistory },
    { data: scores },
    { data: risks },
    { data: financials },
    { data: activations },
  ] = await Promise.all([
    supabase.from('documents').select('id, original_filename, storage_path, document_type, uploaded_at').eq('proposal_id', params.id),
    supabase
      .from('ai_extractions')
      .select('extracted_json, model_used, status, created_at')
      .eq('proposal_id', params.id)
      .order('created_at', { ascending: false }),
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
        'id, source, status, priority, expected_impact, effort, responsible, start_date, end_date, created_at, ' +
          'kpi_target, kpi_result, is_reusable, useful_life, ' +
          'activation_catalog_items(area, name), channels(name), kpi_definitions(name)',
      )
      .eq('proposal_id', params.id)
      .order('created_at', { ascending: true }),
  ]);

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );

  const latestExtraction = extractionHistory?.[0] ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractedJson = (latestExtraction?.extracted_json ?? null) as Record<string, any> | null;

  const stage = getWorkspaceStage(proposal);
  const tone = getTone({ totalScore: proposal.total_score, overallRiskLevel: proposal.overall_risk_level });
  const canEdit = !proposal.submitted_at; // permiso real — igual que /edit, no solo "stage === draft"

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
  const roiLabel = roi === null ? '—' : roi >= 3 ? 'Alto' : roi >= 1.5 ? 'Medio' : 'Bajo';

  const globalRiskScore = computeGlobalRiskScore((risks ?? []).map((r: any) => r.computed_score));

  const executiveSummary = await generateExecutiveSummary({
    proposal: { total_score: proposal.total_score, recommendation: proposal.recommendation, overall_risk_level: proposal.overall_risk_level },
    scores: scores ?? [],
    risks: risks ?? [],
    pendingActivations,
  });
  const { strengths, weaknesses } = generateStrengthsAndWeaknesses(scores ?? []);

  // Timeline con iconos — derivada de timestamps ya existentes, sin tabla nueva.
  // Scoring/riesgo/financials se guardan atómicamente en la misma llamada (saveOutcome),
  // así que es UN solo evento real, no tres marcas de tiempo distintas fabricadas.
  const timelineEvents: { icon: string; label: string; date: string }[] = [];
  timelineEvents.push({ icon: '📥', label: 'Propuesta recibida', date: proposal.created_at });
  for (const ex of extractionHistory ?? []) {
    timelineEvents.push({ icon: '🤖', label: `Documento procesado (${ex.model_used})`, date: ex.created_at });
  }
  if (scores?.length) {
    timelineEvents.push({ icon: '📊', label: 'Evaluación completada (score, riesgo y financials)', date: proposal.updated_at ?? proposal.created_at });
  }
  for (const a of activations ?? []) {
    timelineEvents.push({ icon: '🎯', label: `Activación añadida: ${(a as any).activation_catalog_items?.name ?? ''}`, date: (a as any).created_at });
  }
  if (proposal.submitted_at) timelineEvents.push({ icon: '📤', label: 'Propuesta enviada', date: proposal.submitted_at });
  if (proposal.rejected_at) timelineEvents.push({ icon: '❌', label: 'Propuesta rechazada', date: proposal.rejected_at });
  if (proposal.approved_at) timelineEvents.push({ icon: '✅', label: 'Propuesta aprobada', date: proposal.approved_at });
  if (proposal.finalized_at) timelineEvents.push({ icon: '🏁', label: 'Propuesta finalizada', date: proposal.finalized_at });
  timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Adjuntos agrupados por tipo — solo se muestran categorías con al menos 1 documento.
  const documentsByType = new Map<string, typeof documentsWithUrls>();
  for (const doc of documentsWithUrls) {
    const key = doc.document_type ?? 'other';
    if (!documentsByType.has(key)) documentsByType.set(key, []);
    documentsByType.get(key)!.push(doc);
  }

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
              {canEdit ? <InlineEditable value={proposal.title} onSave={updateTitle} fontSize={22} fontWeight={700} /> : proposal.title}
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
          {canEdit && (
            <Link href={`/proposals/${proposal.id}/edit`} className="btn btn-outline">
              ✏️ Editar
            </Link>
          )}
          <LifecycleActions proposalId={proposal.id} approvedAt={proposal.approved_at} finalizedAt={proposal.finalized_at} />
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARY ── */}
      <InsightCard title="Executive Summary">
        {executiveSummary.map((paragraph, i) => (
          <p key={i} style={{ margin: '0 0 8px' }}>
            {paragraph}
          </p>
        ))}
      </InsightCard>

      {/* ── DECISION STRIP (fijo, con score/riesgo/ROI/estado/recomendación + acciones) ── */}
      <DecisionStrip
        proposalId={proposal.id}
        stage={stage}
        tone={tone}
        totalScore={proposal.total_score}
        overallRiskLevel={proposal.overall_risk_level}
        roi={roi}
        recommendation={proposal.recommendation}
      />

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

      {/* ── EVALUACIÓN DETALLADA ── */}
      <div className="card">
        <div className="card-title">Evaluación detallada</div>
        {!scores?.length ? (
          <EmptyState message="Sin evaluación todavía." />
        ) : (
          <>
            {(scores as any[]).map((s, i) => {
              const pct = Math.min(100, (Number(s.score_value) / Number(s.scoring_attributes?.max_score || 1)) * 100);
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span>
                      {s.scoring_attributes?.scoring_blocks?.name} — {s.scoring_attributes?.name}
                    </span>
                    <strong>
                      {Number(s.score_value).toFixed(2)} / {s.scoring_attributes?.max_score}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--c-light)', borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${pct}%`, background: 'var(--c-amber)', height: 6, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--c-line)' }}>
              <div style={{ flex: 1 }}>
                <div className="card-title" style={{ borderBottom: 'none', marginBottom: 6 }}>
                  Fortalezas
                </div>
                {!strengths.length ? (
                  <p style={{ fontSize: 13, color: 'var(--c-mid)', margin: 0 }}>Ninguna destaca especialmente.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="card-title" style={{ borderBottom: 'none', marginBottom: 6 }}>
                  Debilidades
                </div>
                {!weaknesses.length ? (
                  <p style={{ fontSize: 13, color: 'var(--c-mid)', margin: 0 }}>Ninguna especialmente débil.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── MATRIZ DE RIESGO ── */}
      <div className="card">
        <div className="card-title">Riesgo</div>
        {globalRiskScore !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
            <ConfidenceRing totalScore={1 - globalRiskScore / 100} overallRiskLevel={proposal.overall_risk_level} size="lg" />
            <div>
              <div className="stat-label">Riesgo global</div>
              <div className="stat-value">{proposal.overall_risk_level ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--c-mid)' }}>{globalRiskScore} / 100</div>
            </div>
          </div>
        )}
        {!risks?.length ? (
          <EmptyState message="Sin riesgos evaluados." />
        ) : (
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
              {(risks as any[]).map((r, i) => (
                <tr key={i}>
                  <td>{r.risk_factors?.risk_blocks?.name}</td>
                  <td>{r.risk_factors?.name}</td>
                  <td>
                    <RiskBadge level={r.level} />
                  </td>
                  <td>
                    <RiskBadge level={r.impact} />
                  </td>
                  <td>{r.computed_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── FINANCIALS ── */}
      <div className="card">
        <div className="card-title">Financials</div>
        <div className="stat-block" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="stat-label">Inversión prevista</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalCost.toLocaleString('es-ES')} €</div>
          </div>
          <div>
            <div className="stat-label">Inversión real</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--c-mid)' }}>— (sin registrar)</div>
          </div>
          <div>
            <div className="stat-label">Retorno previsto</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalResult.toLocaleString('es-ES')} €</div>
          </div>
          <div>
            <div className="stat-label">ROI</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{roi !== null ? `${roi.toFixed(1)}x` : '—'}</div>
          </div>
          <div>
            <div className="stat-label">Desviación</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--c-mid)' }}>— (sin coste real)</div>
          </div>
        </div>
        {!financials?.length ? (
          <EmptyState message="Sin líneas financieras registradas." />
        ) : (
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
              {(financials as any[]).map((f, i) => (
                <tr key={i}>
                  <td>{f.economic_concepts?.name}</td>
                  <td>{f.economic_concepts?.block_type ?? '—'}</td>
                  <td>{f.economic_concepts?.nature === 'cost' ? 'Coste' : 'Resultado'}</td>
                  <td>{f.estimated_amount !== null ? `${Number(f.estimated_amount).toLocaleString('es-ES')} €` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ACTIVACIONES ── */}
      <div className="card">
        <div className="card-title">Activaciones</div>
        {!activations?.length ? (
          <EmptyState message="Sin plan de activación definido." actionHref={`/proposals/${proposal.id}/edit`} actionLabel="Añadir acciones" />
        ) : (
          <>
            <div className="stat-block" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div className="stat-value" style={{ fontSize: 20 }}>{activations.length}</div>
                <div className="stat-label">Activaciones</div>
              </div>
              <div>
                <div className="stat-value" style={{ fontSize: 20 }}>{(activations as any[]).filter((a) => a.priority === 'Alta').length}</div>
                <div className="stat-label">Alta prioridad</div>
              </div>
              <div>
                <div className="stat-value" style={{ fontSize: 20 }}>{(activations as any[]).filter((a) => a.is_reusable).length}</div>
                <div className="stat-label">Reutilizables</div>
              </div>
              <div>
                <div className="stat-value" style={{ fontSize: 20 }}>{roiLabel}</div>
                <div className="stat-label">ROI esperado</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
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
                  {(activations as any[]).map((a) => (
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
            </div>
          </>
        )}
      </div>

      {/* ── TIMELINE (con iconos, estilo GitHub/Linear) ── */}
      <div className="card">
        <div className="card-title">Timeline</div>
        <div className="timeline">
          {timelineEvents.map((ev, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-icon">{ev.icon}</div>
              <div className="timeline-body">
                <div style={{ fontSize: 13 }}>{ev.label}</div>
                <div style={{ fontSize: 11, color: 'var(--c-mid)' }}>{new Date(ev.date).toLocaleString('es-ES')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comentarios internos: oculto a propósito hasta que exista persistencia real
          (proposal_comments) — ver conversación sobre esta fase. No se muestra ninguna
          caja vacía. */}

      {/* ── ARCHIVOS ADJUNTOS (categorizados) ── */}
      <div className="card">
        <div className="card-title">Archivos adjuntos ({documentsWithUrls.length})</div>
        {!documentsWithUrls.length ? (
          <EmptyState message="Sin documentos adjuntos." />
        ) : (
          DOCUMENT_TYPE_ORDER.filter((type) => documentsByType.has(type)).map((type) => (
            <div key={type} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 6 }}>{DOCUMENT_TYPE_LABEL[type]}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
                {documentsByType.get(type)!.map((doc) => (
                  <li key={doc.id} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{doc.original_filename}</span>
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
            </div>
          ))
        )}
      </div>

      {/* ── HISTORIAL DE CAMBIOS ── */}
      <div className="card">
        <div className="card-title">Historial de cambios</div>
        {!extractionHistory?.length ? (
          <EmptyState message="Sin historial todavía." />
        ) : (
          <ul className="mini-list">
            {extractionHistory.map((ex, i) => (
              <li key={i}>
                <span>
                  Extracción v{extractionHistory.length - i} ({ex.model_used}) — {(ex.extracted_json as any)?.summary?.slice(0, 60) ?? 'sin resumen'}
                  {(ex.extracted_json as any)?.summary?.length > 60 ? '…' : ''}
                </span>
                <span style={{ color: 'var(--c-mid)', fontSize: 12 }}>{new Date(ex.created_at).toLocaleString('es-ES')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
