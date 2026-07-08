// src/app/proposals/pipeline-view.tsx
// El "Pipeline de decisiones" — sustituye la tabla plana. Recibe TODOS los datos ya
// resueltos desde el Server Component (page.tsx) y hace filtrado/orden/búsqueda en el
// cliente (la cantidad de propuestas de una organización es pequeña; no compensa un
// round-trip al servidor por cada filtro, y así se siente instantáneo, como Linear/Notion).
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConfidenceRing } from '@/components/confidence-ring';
import { ScoreBadge, RiskBadge, StatusPill } from '@/components/badges';
import { EmptyState } from '@/components/empty-state';
import { WorkspaceStage } from '@/lib/workspace-stage';

export interface PipelineProposal {
  id: string;
  title: string;
  brandName: string;
  partnerName: string | null;
  responsibleName: string | null;
  totalScore: number | null;
  overallRiskLevel: string | null;
  recommendation: string | null;
  stage: WorkspaceStage;
  createdAt: string;
  updatedAt: string;
}

const RISK_WEIGHT: Record<string, number> = { Alto: 2, Medio: 1, Bajo: 0 };
const RECOMMENDATION_COLOR: Record<string, string> = {
  Recomendable: 'var(--c-green)',
  Táctico: 'var(--c-amber)',
  'No recomendable': 'var(--c-red)',
};
const STAGE_OPTIONS: { value: WorkspaceStage | 'pending' | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendientes de decisión' },
  { value: 'draft', label: 'Borrador' },
  { value: 'evaluated', label: 'Evaluada' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'rejected', label: 'Rechazada' },
  { value: 'finalized', label: 'Finalizada' },
  { value: 'archived', label: 'Archivada' },
];

function isPendingDecision(p: PipelineProposal): boolean {
  return p.stage === 'evaluated';
}

/** Prioridad de decisión (Documento de Fase 3): pendientes → score alto → riesgo bajo → resto. */
function priorityCompare(a: PipelineProposal, b: PipelineProposal): number {
  const pendingA = isPendingDecision(a) ? 0 : 1;
  const pendingB = isPendingDecision(b) ? 0 : 1;
  if (pendingA !== pendingB) return pendingA - pendingB;

  const scoreA = a.totalScore ?? -1;
  const scoreB = b.totalScore ?? -1;
  if (scoreA !== scoreB) return scoreB - scoreA;

  const riskA = RISK_WEIGHT[a.overallRiskLevel ?? ''] ?? 1;
  const riskB = RISK_WEIGHT[b.overallRiskLevel ?? ''] ?? 1;
  if (riskA !== riskB) return riskA - riskB;

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function PipelineView({ proposals, initialStageFilter }: { proposals: PipelineProposal[]; initialStageFilter?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>(initialStageFilter ?? 'all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [busyId, setBusyId] = useState<string | null>(null);

  const brands = useMemo(() => Array.from(new Set(proposals.map((p) => p.brandName))).sort(), [proposals]);
  const responsibles = useMemo(
    () => Array.from(new Set(proposals.map((p) => p.responsibleName).filter((r): r is string => Boolean(r)))).sort(),
    [proposals],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals
      .filter((p) => {
        if (stageFilter === 'pending' && !isPendingDecision(p)) return false;
        if (stageFilter !== 'all' && stageFilter !== 'pending' && p.stage !== stageFilter) return false;
        if (brandFilter !== 'all' && p.brandName !== brandFilter) return false;
        if (riskFilter !== 'all' && p.overallRiskLevel !== riskFilter) return false;
        if (responsibleFilter !== 'all' && p.responsibleName !== responsibleFilter) return false;
        if (scoreFilter === 'high' && (p.totalScore ?? 0) < 0.7) return false;
        if (scoreFilter === 'mid' && ((p.totalScore ?? 0) < 0.4 || (p.totalScore ?? 0) >= 0.7)) return false;
        if (scoreFilter === 'low' && (p.totalScore ?? 1) >= 0.4) return false;
        if (q) {
          const haystack = `${p.title} ${p.brandName} ${p.partnerName ?? ''}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort(priorityCompare);
  }, [proposals, search, stageFilter, brandFilter, riskFilter, responsibleFilter, scoreFilter]);

  async function runAction(id: string, action: 'approve' | 'reject' | 'request-review' | 'archive') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/proposals/${id}/${action}`, { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar la propuesta.');
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, marca u organización solicitante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        <div className="view-selector">
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
            Lista
          </button>
          <button disabled title="Próximamente">
            Kanban
          </button>
          <button disabled title="Próximamente">
            Calendario
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          {STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="all">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
          <option value="all">Cualquier score</option>
          <option value="high">Score alto (≥70%)</option>
          <option value="mid">Score medio (40-70%)</option>
          <option value="low">Score bajo (&lt;40%)</option>
        </select>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          <option value="all">Cualquier riesgo</option>
          <option value="Bajo">Riesgo bajo</option>
          <option value="Medio">Riesgo medio</option>
          <option value="Alto">Riesgo alto</option>
        </select>
        {responsibles.length > 0 && (
          <select value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)}>
            <option value="all">Cualquier responsable</option>
            {responsibles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 12, color: 'var(--c-mid)' }}>{filtered.length} de {proposals.length}</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {!filtered.length ? (
          <EmptyState message="Ninguna propuesta coincide con estos filtros." />
        ) : (
          filtered.map((p) => {
            const canDecide = p.stage === 'evaluated';
            const canArchive = p.stage !== 'archived';
            return (
              <div key={p.id} className="pipeline-card">
                <ConfidenceRing totalScore={p.totalScore} overallRiskLevel={p.overallRiskLevel} size="sm" />

                <div className="avatar-fallback">{(p.partnerName ?? p.brandName ?? '?').charAt(0).toUpperCase()}</div>

                <div style={{ flex: 2, minWidth: 0 }}>
                  <Link href={`/proposals/${p.id}`} className="proposal-title" style={{ display: 'block' }}>
                    {p.title}
                  </Link>
                  <div className="proposal-meta">
                    {p.brandName}
                    {p.partnerName ? ` · ${p.partnerName}` : ''}
                  </div>
                </div>

                <div style={{ flex: 1, fontSize: 12, color: 'var(--c-mid)' }}>{p.responsibleName ?? '—'}</div>

                <ScoreBadge totalScore={p.totalScore} />
                <RiskBadge level={p.overallRiskLevel} />
                <StatusPill stage={p.stage} />

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 100,
                    textAlign: 'right',
                    color: p.recommendation ? RECOMMENDATION_COLOR[p.recommendation] ?? 'inherit' : 'var(--c-mid)',
                  }}
                >
                  {p.recommendation ?? '—'}
                </span>

                <div style={{ fontSize: 11, color: 'var(--c-mid)', minWidth: 70, textAlign: 'right' }}>
                  {new Date(p.updatedAt).toLocaleDateString('es-ES')}
                </div>

                <div className="pipeline-card-quick-actions">
                  {canDecide && (
                    <>
                      <button disabled={busyId === p.id} onClick={() => runAction(p.id, 'approve')}>
                        Aprobar
                      </button>
                      <button disabled={busyId === p.id} onClick={() => runAction(p.id, 'request-review')}>
                        Revisión
                      </button>
                      <button disabled={busyId === p.id} onClick={() => runAction(p.id, 'reject')} style={{ color: 'var(--c-red)' }}>
                        Rechazar
                      </button>
                    </>
                  )}
                  {canArchive && (
                    <button disabled={busyId === p.id} onClick={() => runAction(p.id, 'archive')}>
                      Archivar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
