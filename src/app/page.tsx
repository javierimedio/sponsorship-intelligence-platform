// src/app/page.tsx
// Dashboard ejecutivo (Documento 6, §2) — sustituye la home genérica anterior.
// Cada bloque responde a UNA de las 6 preguntas, sin exigir ningún clic adicional.

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
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
      <main style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
        <h1>GorFactory Collaboration Intelligence</h1>
        <p>No has iniciado sesión.</p>
        <Link href="/login">Iniciar sesión</Link>
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

  const [{ data: proposals }, { data: risks }, { data: financials }] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, title, total_score, overall_risk_level, recommendation, submitted_at, approved_at, finalized_at, brand_id, brands(name)')
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
  for (const f of (financials ?? []) as any[]) {
    if (f.economic_concepts?.nature !== 'cost' || f.estimated_amount === null) continue;
    const brandName = f.proposals?.brands?.name ?? 'Corporativo';
    budgetByBrand.set(brandName, (budgetByBrand.get(brandName) ?? 0) + Number(f.estimated_amount));
  }
  const totalBudget = [...budgetByBrand.values()].reduce((a, b) => a + b, 0);

  // Pregunta 6: ¿Qué riesgos tengo abiertos? — factores Alto en propuestas no finalizadas
  const openHighRisks = risks?.length ?? 0;

  // Pipeline: cuenta por etapa del Workspace adaptativo
  const pipelineCounts: Record<WorkspaceStage, number> = { draft: 0, evaluated: 0, approved: 0, finalized: 0 };
  for (const p of rows) {
    pipelineCounts[getWorkspaceStage(p)]++;
  }

  return (
    <AppShell>
      <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: 'var(--c-mid)', marginTop: 0, marginBottom: 24 }}>
        Sesión iniciada como <strong>{user.email}</strong>
      </p>

      {/* Preguntas 1, 5, 6 — cifras clave, sin clics */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{active.length}</div>
          <div className="kpi-label">Propuestas abiertas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{awaitingApproval.length}</div>
          <div className="kpi-label">Esperando tu decisión</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: openHighRisks > 0 ? 'var(--c-red)' : 'var(--c-dark)' }}>
            {openHighRisks}
          </div>
          <div className="kpi-label">Riesgos altos abiertos</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{totalBudget.toLocaleString('es-ES')} €</div>
          <div className="kpi-label">Presupuesto comprometido</div>
        </div>
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
            <div className="pipeline-count">{pipelineCounts.approved}</div>
            <div className="pipeline-label">Aprobada</div>
          </div>
          <div className="pipeline-stage">
            <div className="pipeline-count">{pipelineCounts.finalized}</div>
            <div className="pipeline-label">Finalizada</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Pregunta 3: ¿Cuál necesita mi aprobación? */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">Esperando tu decisión ({awaitingApproval.length})</div>
          {!awaitingApproval.length ? (
            <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Nada pendiente de aprobación.</p>
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

        {/* Pregunta 2: ¿Cuáles son prioritarias? */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">Prioritarias</div>
          {!priority.length ? (
            <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Aún no hay propuestas evaluadas.</p>
          ) : (
            <ul className="mini-list">
              {priority.map((p) => (
                <li key={p.id}>
                  <Link href={`/proposals/${p.id}`}>{p.title}</Link>
                  <ScoreBadge totalScore={p.total_score} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {/* Pregunta 4: ¿Qué colaboraciones están funcionando? */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">En ejecución ({inExecution.length})</div>
          {!inExecution.length ? (
            <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Ninguna colaboración aprobada todavía.</p>
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
            <p style={{ color: 'var(--c-mid)', margin: 0, fontSize: 13 }}>Sin datos financieros todavía.</p>
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
      </div>
    </AppShell>
  );
}
