// src/components/decision-strip.tsx
// Enriquecido: Score + Riesgo + ROI + Estado + Recomendación, y los 4 botones de acción.
// Sigue siendo EL componente adaptativo — mismo sitio, mismo tamaño, contenido según estado.
// Los botones llaman a las rutas de ciclo de vida ya existentes (o las nuevas de esta ronda).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tone, WorkspaceStage } from '@/lib/workspace-stage';
import { RejectDialog } from './reject-dialog';

interface DecisionStripProps {
  proposalId: string;
  stage: WorkspaceStage;
  tone: Tone;
  totalScore: number | null;
  overallRiskLevel: string | null;
  roi: number | null;
  recommendation: string | null;
  isViewer?: boolean;
}

const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  positive: { bg: 'var(--c-green-l)', fg: 'var(--c-green)' },
  warning: { bg: 'var(--c-amber-l)', fg: 'var(--c-amber)' },
  negative: { bg: 'var(--c-red-l)', fg: 'var(--c-red)' },
  neutral: { bg: 'var(--c-light)', fg: 'var(--c-mid)' },
};

const STAGE_LABEL: Record<WorkspaceStage, string> = {
  draft: 'Borrador',
  evaluated: 'Evaluada',
  rejected: 'Rechazada',
  approved: 'Aprobada',
  finalized: 'Finalizada',
  archived: 'Archivada',
};

export function DecisionStrip({ proposalId, stage, tone, totalScore, overallRiskLevel, roi, recommendation, isViewer }: DecisionStripProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const { bg, fg } = TONE_STYLE[tone];

  async function run(action: 'approve' | 'request-review', label: string) {
    setLoading(label);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/${action}`, { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar la propuesta.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function confirmReject(reason: string) {
    setLoading('reject');
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al rechazar la propuesta.');
      setRejectDialogOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const canDecide = stage === 'evaluated' && !isViewer; // solo se puede aprobar/rechazar/pedir revisión estando Evaluada

  return (
    <div className="decision-strip decision-strip-sticky" style={{ background: bg, color: fg, padding: '.85rem 1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Metric label="Score" value={totalScore !== null ? `${Math.round(totalScore * 100)}%` : '—'} />
          <Metric label="Riesgo" value={overallRiskLevel ?? '—'} />
          <Metric
            label="ROI"
            value={roi !== null ? `${roi.toFixed(1)}x` : '—'}
            title={roi !== null ? `Por cada 1€ invertido, se prevén ${roi.toFixed(2)}€ de retorno` : undefined}
          />
          <Metric label="Estado" value={STAGE_LABEL[stage]} />
          <Metric label="Recomendación" value={recommendation ?? '—'} />
        </div>

        {!isViewer && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => router.refresh()}
              className="btn btn-outline"
              style={{ padding: '.4rem .8rem', fontSize: 12 }}
            >
              Guardar
            </button>
            {canDecide && (
              <>
                <button
                  onClick={() => run('request-review', 'review')}
                  disabled={loading !== null}
                  className="btn btn-outline"
                  style={{ padding: '.4rem .8rem', fontSize: 12 }}
                >
                  {loading === 'review' ? '...' : 'Solicitar revisión'}
                </button>
                <button
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={loading !== null}
                  className="btn btn-outline"
                  style={{ padding: '.4rem .8rem', fontSize: 12, color: 'var(--c-red)', borderColor: 'var(--c-red)' }}
                >
                  Rechazar
                </button>
                <button
                  onClick={() => run('approve', 'approve')}
                  disabled={loading !== null}
                  className="btn btn-amber"
                  style={{ padding: '.4rem .8rem', fontSize: 12 }}
                >
                  {loading === 'approve' ? '...' : 'Aprobar'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>{error}</p>}

      <RejectDialog
        open={rejectDialogOpen}
        onCancel={() => setRejectDialogOpen(false)}
        onConfirm={confirmReject}
        loading={loading === 'reject'}
      />
    </div>
  );
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
