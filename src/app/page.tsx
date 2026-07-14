// src/app/page.tsx
// Dashboard ejecutivo (Documento 6, §2) — sustituye la home genérica anterior.
// Cada bloque responde a UNA de las 6 preguntas, sin exigir ningún clic adicional.

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
import { KPICard } from '@/components/metric-card';
import { EmptyState } from '@/components/empty-state';
import { InsightCard } from '@/components/insight-card';
import { DecisionCard } from '@/components/decision-card';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { getWorkspaceStage, WorkspaceStage } from '@/lib/workspace-stage';

interface ProposalRow {
  id: string;
  title: string;
  total_score: number | null;
  overall_risk_level: string | null;
  recommendation: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  finalized_at: string | null;
  brand_id: string | null;
  brands: { name: string } | null;
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif',
          background: 'linear-gradient(rgba(0,0,0,.68), rgba(0,0,0,.78)), url(/images/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          textAlign: 'center',
        }}
      >
        <img
          src="https://paqtohmxagfebeyyurlq.supabase.co/storage/v1/object/public/assets/GORFACTORY_LOGO_BLANCO.png"
          alt="GOR Factory"
          style={{ height: 44, marginBottom: 24 }}
        />
        <h1 style={{ color: 'white', fontSize: 28, margin: '0 0 8px' }}>Sponsorship Intelligence Platform</h1>
        <p style={{ color: 'rgba(255,255,255,.75)', margin: '0 0 32px', fontSize: 14 }}>
          Evaluación y gestión inteligente de colaboraciones y patrocinios
        </p>
        <Link
          href="/login"
          className="btn btn-amber"
          style={{ padding: '.75rem 2rem', fontSize: 14 }}
        >
          Iniciar sesión
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 48 }}>
          <img src="https://static.gorfactory.es/images/header/logo_Roly_2025.svg" alt="Roly" style={{ height: 18, filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
          <img src="https://static.gorfactory.es/images/home/Logo_WRK_color.svg" alt="Roly WRK" style={{ height: 18, filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
          <img src="https://static.gorfactory.es/images/header/logo-stm-small.svg" alt="Stamina" style={{ height: 18, filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
        </div>
      </main>
    );
  }

  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return (
      <AppShell>
        <p>Tu usuario no tiene perfil de negocio asignado todavía.</p>
      </AppShell>
    );
  }

  const [{ data: proposals }, { data: risks }, { data: financials }, { data: activationsInProgress }, { data: rejectedProposals }] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, title, total_score, overall_risk_level, recommendation, submitted_at, approved_at, rejected_at, finalized_at, brand_id, brands(name)')
      .eq('organization_id', profile.organizationId),
    supabase
      .from('proposal_risks')
      .select('level, proposal_id, proposals!inner(finalized_at, organization_id)')
      .eq('level', 'Alto')
      .eq('proposals.organization_id', profile.organizationId)
      .is('proposals.finalized_at', null),
    supabase
      .from('proposal_financials')
      .select('estimated_amount, economic_concepts(nature), proposals!inner(brand_id, organization_id, brands(name))')
      .eq('proposals.organization_id', profile.organizationId),
    supabase
      .from('proposal_activations')
      .select('id, status, proposals!inner(organization_id, finalized_at)')
      .in('status', ['pending', 'in_progress'])
      .eq('proposals.organization_id', profile.organizationId)
      .is('proposals.finalized_at', null),
    supabase
      .from('proposals')
      .select('id, rejection_reason, proposal_financials(estimated_amount, economic_concepts(nature))')
      .eq('organization_id', profile.organizationId)
      .not('rejected_at', 'is', null),
  ]);

  const rows = (proposals ?? []) as unknown as ProposalRow[];

  // Pregunta 1: ¿Qué propuestas tengo abiertas? (todo lo que no está finalizado)
  const active = rows.filter((p) => !p.finalized_at);

  // Pregunta 2: ¿Cuáles son prioritarias? — score más alto entre las activas y ya evaluadas
  const priority = active
    .filter((p) => p.total_score !== null)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 5);

  // Pregunta 3: ¿Cuál necesita mi aprobación? — enviadas, evaluadas, sin aprobar todavía
  const awaitingApproval = rows.filter((p) => p.submitted_at && !p.approved_at && !p.finalized_at);

  // Pregunta 4: ¿Qué colaboraciones están funcionando? — aprobadas, en ejecución
  const inExecution = rows.filter((p) => p.approved_at && !p.finalized_at);

  // Pregunta 5: ¿Dónde estoy gastando el presupuesto? — costes agrupados por marca
  const budgetByBrand = new Map<string, number>();
  let totalCostAll = 0;
  let totalResultAll = 0;
  for (const f of (financials ?? []) as any[]) {
    if (f.estimated_amount === null) continue;
    if (f.economic_concepts?.nature === 'cost') {
      totalCostAll += Number(f.estimated_amount);
      const brandName = f.proposals?.brands?.name ?? 'Corporativo';
      budgetByBrand.set(brandName, (budgetByBrand.get(brandName) ?? 0) + Number(f.estimated_amount));
    } else if (f.economic_concepts?.nature === 'result') {
      totalResultAll += Number(f.estimated_amount);
    }
  }
  const totalBudget = totalCostAll;
  const roiForecast = totalCostAll > 0 ? totalResultAll / totalCostAll : null;

  // Pregunta 6: ¿Qué riesgos tengo abiertos? — factores Alto en propuestas no finalizadas
  const openHighRisks = risks?.length ?? 0;

  // Score medio y nº de aprobadas — para las KPI cards
  const scored = rows.filter((p) => p.total_score !== null);
  const avgScore = scored.length ? scored.reduce((sum, p) => sum + (p.total_score ?? 0), 0) / scored.length : null;
  const approvedCount = rows.filter((p) => p.approved_at).length;

  // Oportunidad perdida: propuestas rechazadas, su valor económico solicitado y por qué.
  const lostValue = (rejectedProposals ?? []).reduce((sum: number, p: any) => {
    const cost = (p.proposal_financials ?? [])
      .filter((f: any) => f.economic_concepts?.nature === 'cost' && f.estimated_amount !== null)
      .reduce((s: number, f: any) => s + Number(f.estimated_amount), 0);
    return sum + cost;
  }, 0);
  const reasonCounts = new Map<string, number>();
  for (const p of (rejectedProposals ?? []) as any[]) {
    const reason = p.rejection_reason?.trim() || 'Sin motivo especificado';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  // Pipeline: cuenta por etapa del Workspace adaptativo
  const pipelineCounts: Record<WorkspaceStage, number> = { draft: 0, evaluated: 0, rejected: 0, approved: 0, finalized: 0, archived: 0 };
  for (const p of rows) {
    pipelineCounts[getWorkspaceStage(p)]++;
  }

  return (
    <AppShell>
      <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: 'var(--c-mid)', marginTop: 0, marginBottom: 24 }}>
        Sesión iniciada como <strong>{user.email}</strong>
      </p>

      {/* Executive Summary — redactado, no un chat. Determinista por ahora (usa los mismos
          datos ya calculados); la redacción por IA real es una fase posterior. */}
      <InsightCard title="Resumen ejecutivo">
        Hay <strong>{active.length} propuestas abiertas</strong>
        {awaitingApproval.length > 0 && (
          <>
            , de las cuales <strong>{awaitingApproval.length} esperan tu decisión</strong>
          </>
        )}
        {priority[0] && (
          <>
            . La más prioritaria es <strong>&quot;{priority[0].title}&quot;</strong>
            {priority[0].total_score !== null && ` (score ${Math.round(priority[0].total_score * 100)}%)`}
          </>
        )}
        {openHighRisks > 0 && (
          <>
            . Hay <strong>{openHighRisks} riesgo(s) alto(s)</strong> abiertos sin mitigar
          </>
        )}
        {totalBudget > 0 && (
          <>
            . El presupuesto comprometido asciende a <strong>{totalBudget.toLocaleString('es-ES')} €</strong>
            {roiForecast !== null && ` con un ROI previsto de ${roiForecast.toFixed(1)}x`}
          </>
        )}
        .
      </InsightCard>

      {/* Preguntas 1, 2, 5, 6 — cifras clave, sin clics */}
      <div className="kpi-grid">
        <KPICard label="Propuestas abiertas" value={active.length} />
        <KPICard label="Esperando decisión" value={awaitingApproval.length} tone={awaitingApproval.length ? 'warning' : 'neutral'} />
        <KPICard label="Aprobadas" value={approvedCount} tone="positive" />
        <KPICard label="Score medio" value={avgScore !== null ? `${Math.round(avgScore * 100)}%` : '—'} />
        <KPICard label="Riesgos altos abiertos" value={openHighRisks} tone={openHighRisks > 0 ? 'negative' : 'neutral'} />
        <KPICard label="Presupuesto comprometido" value={`${totalBudget.toLocaleString('es-ES')} €`} />
        <KPICard
          label="ROI previsto"
          value={roiForecast !== null ? `${roiForecast.toFixed(1)}x` : '—'}
          tone="positive"
          hint={roiForecast !== null ? `Por cada 1€ invertido, se prevén ${roiForecast.toFixed(2)}€ de retorno` : undefined}
        />
        <KPICard label="Activaciones en curso" value={activationsInProgress?.length ?? 0} />
      </div>

      {/* Pipeline — vista general del embudo */}
      <div className="card">
        <div className="card-title">Pipeline</div>
        <div className="pipeline">
          <div className="pipeline-stage">
            <div className="pipeline-count">{pipelineCounts.draft}</div>
            <div className="pipeline-label">Borrador</div>
          </div>
          <div className="pipeline-stage">
            <div className="pipeline-count">{pipelineCounts.evaluated}</div>
            <div className="pipeline-label">Evaluada</div>
          </div>
          <div className="pipeline-stage">
            <div className="pipeline-count" style={{ color: pipelineCounts.rejected > 0 ? 'var(--c-red)' : undefined }}>
              {pipelineCounts.rejected}
            </div>
            <div className="pipeline-label">Rechazada</div>
          </div>
          <div className="pipeline-stage">
            <div className="pipeline-count">{pipelineCounts.approved}</div>
            <div className="pipeline-label">Aprobada</div>
          </div>
          <div className="pipeline-stage">
            <div className="pipeline-count">{pipelineCounts.finalized}</div>
            <div className="pipeline-label">Finalizada</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Pregunta 3: ¿Cuál necesita mi aprobación? */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">
            <Link href="/proposals?estado=pendiente">Esperando tu decisión ({awaitingApproval.length}) →</Link>
          </div>
          {!awaitingApproval.length ? (
            <EmptyState message="Nada pendiente de aprobación." />
          ) : (
            <ul className="mini-list">
              {awaitingApproval.map((p) => (
                <li key={p.id}>
                  <Link href={`/proposals/${p.id}`}>{p.title}</Link>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <ScoreBadge totalScore={p.total_score} />
                    <RiskBadge level={p.overall_risk_level} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pregunta 2: ¿Cuáles son prioritarias? — tarjetas visuales, no lista */}
      <div className="card">
        <div className="card-title">
          <Link href="/proposals">Prioritarias →</Link>
        </div>
        {!priority.length ? (
          <EmptyState message="Aún no hay propuestas evaluadas." />
        ) : (
          priority.map((p) => (
            <DecisionCard
              key={p.id}
              proposalId={p.id}
              title={p.title}
              brandName={p.brands?.name ?? 'Corporativo'}
              totalScore={p.total_score}
              overallRiskLevel={p.overall_risk_level}
              recommendation={p.recommendation}
            />
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {/* Pregunta 4: ¿Qué colaboraciones están funcionando? */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">En ejecución ({inExecution.length})</div>
          {!inExecution.length ? (
            <EmptyState message="Ninguna colaboración aprobada todavía." />
          ) : (
            <ul className="mini-list">
              {inExecution.map((p) => (
                <li key={p.id}>
                  <Link href={`/proposals/${p.id}`}>{p.title}</Link>
                  <StatusPill stage={getWorkspaceStage(p)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pregunta 5, detalle: presupuesto por marca */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">Presupuesto por marca</div>
          {!budgetByBrand.size ? (
            <EmptyState message="Sin datos financieros todavía." />
          ) : (
            <ul className="mini-list">
              {[...budgetByBrand.entries()].map(([brand, amount]) => (
                <li key={brand}>
                  <span>{brand}</span>
                  <strong>{amount.toLocaleString('es-ES')} €</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Oportunidad perdida — propuestas rechazadas, valor y motivo */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">Oportunidad perdida</div>
          {!rejectedProposals?.length ? (
            <EmptyState message="Ninguna propuesta rechazada todavía." />
          ) : (
            <>
              <div className="stat-block" style={{ marginBottom: 10 }}>
                <div>
                  <div className="stat-label">Rechazadas</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{rejectedProposals.length}</div>
                </div>
                <div>
                  <div className="stat-label">Valor solicitado</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{lostValue.toLocaleString('es-ES')} €</div>
                </div>
              </div>
              <ul className="mini-list">
                {[...reasonCounts.entries()].map(([reason, count]) => (
                  <li key={reason}>
                    <span>{reason}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
