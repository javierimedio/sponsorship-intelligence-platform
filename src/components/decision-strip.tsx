// src/components/decision-strip.tsx
// El componente que hace tangible el concepto "adaptativo" (Documento 6, §5): una sola
// franja, siempre en el mismo sitio, que cambia de contenido según el estado — nunca de
// posición ni de forma. Server Component: solo texto + un enlace, sin interactividad.

import Link from 'next/link';
import { Tone, WorkspaceStage } from '@/lib/workspace-stage';

interface DecisionStripProps {
  stage: WorkspaceStage;
  tone: Tone;
  proposalId: string;
  totalScore: number | null;
  overallRiskLevel: string | null;
  recommendation: string | null;
  pendingActivationsCount: number;
  missingFieldsCount: number;
}

const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  positive: { bg: 'var(--c-green-l)', fg: 'var(--c-green)' },
  warning: { bg: 'var(--c-amber-l)', fg: 'var(--c-amber)' },
  negative: { bg: 'var(--c-red-l)', fg: 'var(--c-red)' },
  neutral: { bg: 'var(--c-light)', fg: 'var(--c-mid)' },
};

export function DecisionStrip(props: DecisionStripProps) {
  const { stage, tone, proposalId } = props;
  const { bg, fg } = TONE_STYLE[tone];

  let icon = '•';
  let text = '';
  let action: { href: string; label: string } | null = null;

  if (stage === 'draft') {
    icon = '⚠';
    text =
      props.missingFieldsCount > 0
        ? `Faltan ${props.missingFieldsCount} campo(s) para poder evaluar esta propuesta.`
        : 'Lista para evaluar — completa la extracción y la evaluación.';
    action = { href: `/proposals/${proposalId}/edit`, label: 'Completar →' };
  } else if (stage === 'evaluated') {
    icon = tone === 'positive' ? '✓' : tone === 'negative' ? '✗' : '~';
    const pct = props.totalScore !== null ? Math.round(props.totalScore * 100) : null;
    text = `${props.recommendation ?? 'Sin recomendación'} — score ${pct ?? '—'}%, riesgo ${props.overallRiskLevel ?? '—'}.`;
    action = { href: `/proposals/${proposalId}/edit`, label: 'Editar →' };
  } else if (stage === 'approved') {
    icon = '▶';
    text =
      props.pendingActivationsCount > 0
        ? `${props.pendingActivationsCount} activación(es) pendiente(s) de ejecutar.`
        : 'Sin activaciones pendientes — todo ejecutado.';
    action = null;
  } else {
    icon = '★';
    const pct = props.totalScore !== null ? Math.round(props.totalScore * 100) : null;
    text = `Colaboración finalizada. Score de evaluación: ${pct ?? '—'}%.`;
    action = null;
  }

  return (
    <div
      className="decision-strip"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '.85rem 1.25rem',
        borderRadius: 'var(--radius)',
        marginBottom: '1.5rem',
        background: bg,
        color: fg,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>
        {icon} {text}
      </span>
      {action && (
        <Link href={action.href} style={{ color: fg, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
