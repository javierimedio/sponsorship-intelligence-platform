// src/components/decision-strip.tsx
// Enriquecido: Score + Riesgo + ROI + Estado + Recomendación, y los 4 botones de acción.
// Sigue siendo EL componente adaptativo — mismo sitio, mismo tamaño, contenido según estado.
// Los botones llaman a las rutas de ciclo de vida ya existentes (o las nuevas de esta ronda).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tone, WorkspaceStage } from '@/lib/workspace-stage';

interface DecisionStripProps {
  proposalId: string;
  stage: WorkspaceStage;
  tone: Tone;
  totalScore: number | null;
  overallRiskLevel: string | null;
  roi: number | null;
  recommendation: string | null;
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

export function DecisionStrip({ proposalId, stage, tone, totalScore, overallRiskLevel, roi, recommendation }: DecisionStripProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { bg, fg } = TONE_STYLE[tone];

  async function run(action: 'approve' | 'reject' | 'request-review', label: string) {
    setLoading(label);
    setError(null);
    try {
      let body: string | undefined;
      if (action === 'reject') {
        const reason = window.prompt('Motivo del rechazo (opcional, ayuda a analizar el pipeline más adelante):');
        if (reason === null) {
          setLoading(null);
          return; // canceló el prompt
        }
        body = JSON.stringify({ reason });
      }
      const res = await fetch(`/api/proposals/${proposalId}/${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
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

  const canDecide = stage === 'evaluated'; // solo se puede aprobar/rechazar/pedir revisión estando Evaluada

  return (
    <div className="decision-strip decision-strip-sticky" style={{ background: bg, color: fg, padding: '.85rem 1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Metric label="Score" value={totalScore !== null ? `${Math.round(totalScore * 100)}%` : '—'} />
          <Metric label="Riesgo" value={overallRiskLevel ?? '—'} />
          <Metric label="ROI" value={roi !== null ? `${roi.toFixed(1)}x` : '—'} />
          <Metric label="Estado" value={STAGE_LABEL[stage]} />
          <Metric label="Recomendación" value={recommendation ?? '—'} />
        </div>

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
                onClick={() => run('reject', 'reject')}
                disabled={loading !== null}
                className="btn btn-outline"
                style={{ padding: '.4rem .8rem', fontSize: 12, color: 'var(--c-red)', borderColor: 'var(--c-red)' }}
              >
                {loading === 'reject' ? '...' : 'Rechazar'}
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
      </div>
      {error && <p style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
