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
import { NegotiationSimulator } from '@/components/negotiation-simulator';
import { DecisionConfidenceCard } from '@/components/decision-confidence';
import { computeDecisionQuality, READINESS_LABEL } from '@/lib/decision-quality';

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
    { data: riskMatrixRules },
    { data: orgProposals },
    { data: allScoringAttributes },
    { data: allRiskFactors },
    { data: approvedProposals },
  ] = await Promise.all([
    supabase.from('documents').select('id, original_filename, storage_path, document_type, uploaded_at').eq('proposal_id', params.id),
    supabase
      .from('ai_extractions')
      .select('extracted_json, model_used, status, created_at')
      .eq('proposal_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('proposal_scores')
      .select('scoring_attribute_id, score_value, ai_rationale, source, scoring_attributes(name, max_score, scoring_blocks(name))')
      .eq('proposal_id', params.id),
    supabase
      .from('proposal_risks')
      .select('risk_factor_id, level, impact, computed_score, source, risk_factors(name, risk_blocks(name))')
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
    supabase.from('risk_matrix_rules').select('level, impact, score').eq('organization_id', proposal.organization_id),
    supabase
      .from('proposals')
      .select('id, total_score, brand_id')
      .eq('organization_id', proposal.organization_id)
      .not('total_score', 'is', null),
    supabase.from('scoring_attributes').select('id, scoring_blocks!inner(organization_id)').eq('scoring_blocks.organization_id', proposal.organization_id),
    supabase.from('risk_factors').select('id, risk_blocks!inner(organization_id)').eq('risk_blocks.organization_id', proposal.organization_id),
    supabase
      .from('proposals')
      .select('id, total_score, overall_risk_level, brand_id, brands(name), proposal_financials(estimated_amount, economic_concepts(nature))')
      .eq('organization_id', proposal.organization_id)
      .not('approved_at', 'is', null)
      .is('finalized_at', null),
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

  // "¿Qué penaliza esta propuesta?" — dos fuentes reales, con escalas distintas (0-1 vs
  // 0-9), por eso se muestran en listas separadas en vez de forzarlas a una sola barra.
  const scoringGaps = (scores ?? [])
    .map((s: any) => ({
      label: `${s.scoring_attributes?.scoring_blocks?.name} — ${s.scoring_attributes?.name}`,
      gap: Number(s.scoring_attributes?.max_score ?? 0) - Number(s.score_value),
    }))
    .filter((g) => g.gap > 0.005)
    .sort((a, b) => b.gap - a.gap);
  const maxGap = Math.max(0.001, ...scoringGaps.map((g) => g.gap));

  const relevantRisksForPenalty = (risks ?? [])
    .filter((r: any) => r.level !== 'Bajo' || r.impact !== 'Bajo')
    .map((r: any) => ({ label: r.risk_factors?.name ?? '', score: r.computed_score }))
    .sort((a, b) => b.score - a.score);

  // Benchmark interno — matemática pura sobre el histórico ya existente, sin IA.
  const otherScores = (orgProposals ?? []).map((p: any) => Number(p.total_score));
  const sampleSize = otherScores.length;
  const percentile =
    proposal.total_score !== null && sampleSize > 0
      ? Math.round((otherScores.filter((s) => s <= proposal.total_score!).length / sampleSize) * 100)
      : null;
  const orgAvgScore = sampleSize > 0 ? otherScores.reduce((a, b) => a + b, 0) / sampleSize : null;
  const brandScores = (orgProposals ?? []).filter((p: any) => p.brand_id === proposal.brand_id).map((p: any) => Number(p.total_score));
  const brandAvgScore = brandScores.length ? brandScores.reduce((a, b) => a + b, 0) / brandScores.length : null;

  // Decision Confidence / Missing Information / Decision Readiness — Documento "Executive
  // Experience". Todo derivado de datos ya existentes, cero IA, cero reglas nuevas del motor.
  const decisionQuality = computeDecisionQuality({
    hasRecommendation: Boolean(proposal.recommendation),
    scoresCount: scores?.length ?? 0,
    totalScoringAttributes: allScoringAttributes?.length ?? 0,
    risksCount: risks?.length ?? 0,
    totalRiskFactors: allRiskFactors?.length ?? 0,
    missingFieldsCount: missingFields.length,
    totalTrackedFields: REQUIRED_EXTRACTION_FIELDS.length,
    benchmarkSampleSize: sampleSize,
  });

  // Portfolio Impact — "si apruebas esta propuesta", sobre las ya aprobadas + esta.
  const approvedWithThis = [...(approvedProposals ?? []), { id: proposal.id, total_score: proposal.total_score, overall_risk_level: proposal.overall_risk_level, brand_id: proposal.brand_id, brands: (proposal as any).brands, proposal_financials: financials }];
  const portfolioInvestment = approvedWithThis.reduce((sum: number, p: any) => {
    const cost = (p.proposal_financials ?? [])
      .filter((f: any) => f.economic_concepts?.nature === 'cost' && f.estimated_amount !== null)
      .reduce((s: number, f: any) => s + Number(f.estimated_amount), 0);
    return sum + cost;
  }, 0);
  const portfolioScores = approvedWithThis.filter((p: any) => p.total_score !== null).map((p: any) => Number(p.total_score));
  const portfolioAvgScore = portfolioScores.length ? portfolioScores.reduce((a, b) => a + b, 0) / portfolioScores.length : null;
  const portfolioHighRisk = approvedWithThis.some((p: any) => p.overall_risk_level === 'Alto');
  const portfolioRiskLabel = portfolioHighRisk ? 'Alto' : approvedWithThis.some((p: any) => p.overall_risk_level === 'Medio') ? 'Medio' : 'Bajo';
  const portfolioByBrand = new Map<string, number>();
  for (const p of approvedWithThis as any[]) {
    const name = p.brands?.name ?? 'Corporativo';
    portfolioByBrand.set(name, (portfolioByBrand.get(name) ?? 0) + 1);
  }

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
              <span style={{ fontSize: 11, fontWeight: 700 }}>{READINESS_LABEL[decisionQuality.readiness]}</span>
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

      <div className="card">
        <div className="card-title">Información pendiente</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'var(--c-light)', borderRadius: 4, height: 8 }}>
            <div
              style={{
                width: `${decisionQuality.completenessPct}%`,
                background: decisionQuality.completenessPct === 100 ? 'var(--c-green)' : 'var(--c-amber)',
                height: 8,
                borderRadius: 4,
              }}
            />
          </div>
          <strong style={{ fontSize: 14 }}>{decisionQuality.completenessPct}% completo</strong>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 14 }}>
          {REQUIRED_EXTRACTION_FIELDS.map((f) => {
            const done = extractedJson && extractedJson[f.key] !== null && extractedJson[f.key] !== undefined && extractedJson[f.key] !== '';
            return (
              <li key={f.key} style={{ padding: '6px 0', color: done ? 'var(--c-green)' : 'var(--c-mid)' }}>
                {done ? '✓' : `⚠ No incluye: ${f.label.toLowerCase()}`}
              </li>
            );
          })}
          <li style={{ padding: '6px 0', color: documentsWithUrls.length ? 'var(--c-green)' : 'var(--c-mid)' }}>
            {documentsWithUrls.length ? `✓ Documento adjunto (${documentsWithUrls.length})` : '⚠ Sin documento adjunto'}
          </li>
        </ul>
      </div>

      {proposal.total_score !== null && <DecisionConfidenceCard quality={decisionQuality} />}

      {/* ── EVALUACIÓN DETALLADA ── */}
      <div className="card">
        <div className="card-title">Evaluación detallada</div>
        {!scores?.length ? (
          <EmptyState message="Sin evaluación todavía." />
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 8 }}>
                ¿Por qué tiene este score? — Contribución al resultado
              </div>
              {[...(scores as any[])]
                .sort((a, b) => Number(b.score_value) - Number(a.score_value))
                .map((s, i, sorted) => {
                  const points = Math.round(Number(s.score_value) * 100);
                  const maxPoints = Math.round(Number(sorted[0]?.score_value ?? 1) * 100) || 1;
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span>{s.scoring_attributes?.name}</span>
                        <strong style={{ color: 'var(--c-green)' }}>+{points}</strong>
                      </div>
                      <div style={{ background: 'var(--c-light)', borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${(points / maxPoints) * 100}%`, background: 'var(--c-green)', height: 6, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 8, textAlign: 'right' }}>
                Total: {proposal.total_score !== null ? Math.round(proposal.total_score * 100) : '—'}
              </div>
            </div>

            {(scoringGaps.length > 0 || relevantRisksForPenalty.length > 0) && (
              <div style={{ marginBottom: 20, paddingTop: 16, borderTop: '1px solid var(--c-line)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 8 }}>¿Qué penaliza esta propuesta?</div>

                {scoringGaps.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--c-mid)', marginBottom: 4 }}>Margen de mejora en scoring</div>
                    {scoringGaps.map((g, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span>{g.label}</span>
                          <strong style={{ color: 'var(--c-red)' }}>-{Math.round(g.gap * 100)}</strong>
                        </div>
                        <div style={{ background: 'var(--c-light)', borderRadius: 4, height: 6 }}>
                          <div style={{ width: `${(g.gap / maxGap) * 100}%`, background: 'var(--c-red)', height: 6, borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {relevantRisksForPenalty.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--c-mid)', marginBottom: 4 }}>Factores de riesgo relevantes (escala 0-9)</div>
                    {relevantRisksForPenalty.map((r, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span>{r.label}</span>
                          <strong style={{ color: 'var(--c-red)' }}>{r.score}/9</strong>
                        </div>
                        <div style={{ background: 'var(--c-light)', borderRadius: 4, height: 6 }}>
                          <div style={{ width: `${(r.score / 9) * 100}%`, background: 'var(--c-red)', height: 6, borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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

      {proposal.total_score !== null && (
        <NegotiationSimulator
          proposalId={proposal.id}
          totalScore={proposal.total_score}
          overallRiskLevel={proposal.overall_risk_level}
          currentScores={(scores ?? []).map((s: any) => ({ attributeId: s.scoring_attribute_id, scoreValue: Number(s.score_value) }))}
          risks={(risks ?? []).map((r: any) => ({ factorId: r.risk_factor_id, name: r.risk_factors?.name ?? '', level: r.level, impact: r.impact }))}
          riskMatrixRules={(riskMatrixRules ?? []).map((r: any) => ({ level: r.level, impact: r.impact, score: r.score }))}
        />
      )}

      {proposal.total_score !== null && percentile !== null && (
        <div className="card">
          <div className="card-title">Benchmark interno</div>
          <p style={{ fontSize: 11, color: 'var(--c-mid)', marginTop: 0, marginBottom: 12 }}>
            Basado en {sampleSize} propuesta(s) evaluada(s) en tu organización — matemática pura sobre el histórico, sin IA.
          </p>
          <div className="stat-block" style={{ flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div className="stat-label">Esta propuesta</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{Math.round(proposal.total_score * 100)}</div>
            </div>
            <div>
              <div className="stat-label">Percentil</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{percentile}</div>
              <div style={{ fontSize: 11, color: 'var(--c-mid)' }}>
                {percentile >= 50
                  ? `Entre el ${100 - percentile}% de mejores propuestas analizadas.`
                  : `Por debajo del ${percentile}% de propuestas analizadas.`}
              </div>
            </div>
            {orgAvgScore !== null && (
              <div>
                <div className="stat-label">Score medio organización</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{Math.round(orgAvgScore * 100)}</div>
              </div>
            )}
            {brandAvgScore !== null && (
              <div>
                <div className="stat-label">Score medio {(proposal as any).brands?.name ?? 'Corporativo'}</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{Math.round(brandAvgScore * 100)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {stage !== 'draft' && (
        <div className="card">
          <div className="card-title">Portfolio Impact — si apruebas esta propuesta</div>
          <div className="stat-block" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div className="stat-label">Inversión total</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{portfolioInvestment.toLocaleString('es-ES')} €</div>
            </div>
            <div>
              <div className="stat-label">Score medio</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{portfolioAvgScore !== null ? Math.round(portfolioAvgScore * 100) : '—'}</div>
            </div>
            <div>
              <div className="stat-label">Riesgo global</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{portfolioRiskLabel}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 6 }}>Distribución por marca</div>
          <ul className="mini-list">
            {[...portfolioByBrand.entries()].map(([brand, count]) => (
              <li key={brand}>
                <span>{brand}</span>
                <strong>{Math.round((count / approvedWithThis.length) * 100)}%</strong>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 11, color: 'var(--c-mid)', marginTop: 10, marginBottom: 0 }}>
            Incluye las propuestas ya aprobadas más esta ({approvedWithThis.length} en total).
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Executive Report</div>
        <p style={{ fontSize: 12, color: 'var(--c-mid)', marginTop: 0, marginBottom: 12 }}>
          Genera un informe de 2 páginas listo para imprimir o guardar como PDF (usa el diálogo de impresión del navegador).
        </p>
        <Link href={`/proposals/${proposal.id}/print`} target="_blank" className="btn btn-amber">
          Generar Executive Report
        </Link>
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
                  <td>
                    {f.economic_concepts?.nature === 'cost'
                      ? 'Coste'
                      : f.economic_concepts?.nature === 'resource'
                        ? 'Recurso'
                        : 'Resultado'}
                  </td>
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
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Historial de cambios</span>
          <Link href={`/proposals/${proposal.id}/versions`} style={{ fontSize: 12, fontWeight: 600 }}>
            Ver versiones de evaluación y comparar →
          </Link>
        </div>
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
