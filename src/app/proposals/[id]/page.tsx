// src/app/proposals/[id]/page.tsx
// Proposal Workspace (Fase 2): una única página en scroll vertical, sin pestañas ni
// acordeones — inspirado en Linear/Notion. Reutiliza el motor de datos existente al
// 100%; no se ha creado ninguna tabla nueva. Timeline e Historial de cambios se derivan
// de timestamps y versiones que YA existían (ai_extractions nunca borra intentos
// anteriores). Comentarios internos queda como placeholder explícito: no hay dónde
// persistir un comentario libre sin una tabla nueva, y esta fase tiene prohibido crear una.

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildExecutiveSummary(proposal: any, scores: any[], risks: any[], pendingActivations: any[]): string[] {
  if (proposal.total_score === null) {
    return ['Esta propuesta todavía no ha sido evaluada — no hay nada que interpretar todavía.'];
  }

  const paragraphs: string[] = [];
  const pct = Math.round(proposal.total_score * 100);
  paragraphs.push(
    `Esta propuesta obtiene un score del ${pct}% y una recomendación de "${proposal.recommendation}", con un riesgo global ${proposal.overall_risk_level ?? 'sin calcular'}.`,
  );

  const topScores = [...scores].sort((a, b) => Number(b.score_value) - Number(a.score_value)).slice(0, 2);
  if (topScores.length) {
    paragraphs.push(
      `Los principales motivos son: ${topScores
        .map((s) => `${s.scoring_attributes?.name} (${Number(s.score_value).toFixed(2)}/${s.scoring_attributes?.max_score})`)
        .join(', ')}.`,
    );
  }

  const relevantRisks = risks.filter((r) => r.level === 'Alto' || r.impact === 'Alto');
  paragraphs.push(
    relevantRisks.length
      ? `He detectado ${relevantRisks.length} riesgo(s) relevante(s): ${relevantRisks.map((r) => r.risk_factors?.name).join(', ')}.`
      : 'No he detectado riesgos de nivel alto en esta propuesta.',
  );

  if (pendingActivations.length) {
    const highPriority = pendingActivations.filter((a) => a.priority === 'Alta');
    const list = (highPriority.length ? highPriority : pendingActivations).slice(0, 2);
    paragraphs.push(`Las acciones que más incrementarían el ROI serían: ${list.map((a) => a.activation_catalog_items?.name).join(', ')}.`);
  }

  return paragraphs;
}

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
    supabase.from('documents').select('id, original_filename, storage_path, uploaded_at').eq('proposal_id', params.id),
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

  const executiveSummary = buildExecutiveSummary(proposal, scores ?? [], risks ?? [], pendingActivations);

  // Timeline: derivada de timestamps ya existentes en varias tablas — sin tabla nueva.
  const timelineEvents: { label: string; date: string }[] = [];
  timelineEvents.push({ label: 'Propuesta creada', date: proposal.created_at });
  for (const ex of extractionHistory ?? []) {
    timelineEvents.push({ label: `Extracción (${ex.model_used})`, date: ex.created_at });
  }
  if (scores?.length) {
    timelineEvents.push({ label: 'Evaluación calculada', date: proposal.updated_at ?? proposal.created_at });
  }
  for (const a of activations ?? []) {
    timelineEvents.push({ label: `Activación añadida: ${(a as any).activation_catalog_items?.name ?? ''}`, date: (a as any).created_at });
  }
  if (proposal.submitted_at) timelineEvents.push({ label: 'Propuesta enviada', date: proposal.submitted_at });
  if (proposal.approved_at) timelineEvents.push({ label: 'Propuesta aprobada', date: proposal.approved_at });
  if (proposal.finalized_at) timelineEvents.push({ label: 'Propuesta finalizada', date: proposal.finalized_at });
  timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

      {/* ── 1. HEADER ── */}
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

      {/* ── 2. EXECUTIVE SUMMARY ── */}
      <InsightCard title="Executive Summary">
        {executiveSummary.map((paragraph, i) => (
          <p key={i} style={{ margin: i === 0 ? '0 0 8px' : '0 0 8px' }}>
            {paragraph}
          </p>
        ))}
      </InsightCard>

      {/* ── 3. DECISION STRIP (fijo durante el scroll) ── */}
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

      {/* ── 4. EVALUACIÓN DETALLADA ── */}
      <div className="card">
        <div className="card-title">Evaluación detallada</div>
        {!scores?.length ? (
          <EmptyState message="Sin evaluación todavía." />
        ) : (
          <div>
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
          </div>
        )}
      </div>

      {/* ── 5. MATRIZ DE RIESGO ── */}
      <div className="card">
        <div className="card-title">Matriz de riesgo</div>
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

      {/* ── 6. FINANCIALS ── */}
      <div className="card">
        <div className="card-title">Financials</div>
        <div className="stat-block" style={{ marginBottom: 16 }}>
          <div>
            <div className="stat-label">Coste total</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalCost.toLocaleString('es-ES')} €</div>
          </div>
          <div>
            <div className="stat-label">Retorno esperado</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalResult.toLocaleString('es-ES')} €</div>
          </div>
          <div>
            <div className="stat-label">ROI</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{roi !== null ? `${roi.toFixed(1)}x` : '—'}</div>
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

      {/* ── 7. ACTIVACIONES ── */}
      <div className="card">
        <div className="card-title">Activaciones ({activations?.length ?? 0})</div>
        {!activations?.length ? (
          <EmptyState message="Sin plan de activación definido." actionHref={`/proposals/${proposal.id}/edit`} actionLabel="Añadir acciones" />
        ) : (
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
        )}
      </div>

      {/* ── 8. TIMELINE ── */}
      <div className="card">
        <div className="card-title">Timeline</div>
        <ul className="mini-list">
          {timelineEvents.map((ev, i) => (
            <li key={i}>
              <span>{ev.label}</span>
              <span style={{ color: 'var(--c-mid)', fontSize: 12 }}>{new Date(ev.date).toLocaleString('es-ES')}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── 9. COMENTARIOS INTERNOS — placeholder explícito, requiere tabla nueva ── */}
      <div className="card">
        <div className="card-title">Comentarios internos</div>
        <EmptyState message="Aún no implementado — requiere una tabla nueva de comentarios, fuera del alcance de esta fase (sin cambios de modelo de datos)." />
      </div>

      {/* ── 10. ARCHIVOS ADJUNTOS ── */}
      <div className="card">
        <div className="card-title">Archivos adjuntos ({documentsWithUrls.length})</div>
        {!documentsWithUrls.length ? (
          <EmptyState message="Sin documentos adjuntos." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
            {documentsWithUrls.map((doc) => (
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
        )}
      </div>

      {/* ── 11. HISTORIAL DE CAMBIOS — versiones reales de ai_extractions, nunca se borran ── */}
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
