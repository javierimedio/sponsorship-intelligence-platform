// src/components/badges.tsx
// Tres badges pequeños reutilizados en Dashboard, Listado y Workspace. Deliberadamente
// simples (Documento 6, §7: nada de microinteracciones ni iconografía definitiva todavía).

import { WorkspaceStage } from '@/lib/workspace-stage';

const PILL_STYLE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.03em',
  whiteSpace: 'nowrap',
};

export function ScoreBadge({ totalScore }: { totalScore: number | null }) {
  if (totalScore === null) return <span style={{ ...PILL_STYLE, background: 'var(--c-light)', color: 'var(--c-mid)' }}>—</span>;
  const pct = Math.round(totalScore * 100);
  const color = pct >= 70 ? 'var(--c-green)' : pct >= 40 ? 'var(--c-amber)' : 'var(--c-red)';
  const bg = pct >= 70 ? 'var(--c-green-l)' : pct >= 40 ? 'var(--c-amber-l)' : 'var(--c-red-l)';
  return <span style={{ ...PILL_STYLE, background: bg, color }}>{pct}%</span>;
}

export function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ ...PILL_STYLE, background: 'var(--c-light)', color: 'var(--c-mid)' }}>—</span>;
  const color = level === 'Alto' ? 'var(--c-red)' : level === 'Medio' ? 'var(--c-amber)' : 'var(--c-green)';
  const bg = level === 'Alto' ? 'var(--c-red-l)' : level === 'Medio' ? 'var(--c-amber-l)' : 'var(--c-green-l)';
  return <span style={{ ...PILL_STYLE, background: bg, color }}>{level}</span>;
}

const STAGE_LABEL: Record<WorkspaceStage, string> = {
  draft: 'Borrador',
  evaluated: 'Evaluada',
  approved: 'Aprobada',
  finalized: 'Finalizada',
};
const STAGE_COLOR: Record<WorkspaceStage, { fg: string; bg: string }> = {
  draft: { fg: 'var(--c-mid)', bg: 'var(--c-light)' },
  evaluated: { fg: 'var(--c-blue)', bg: 'var(--c-blue-l)' },
  approved: { fg: 'var(--c-amber)', bg: 'var(--c-amber-l)' },
  finalized: { fg: 'var(--c-green)', bg: 'var(--c-green-l)' },
};

export function StatusPill({ stage }: { stage: WorkspaceStage }) {
  const { fg, bg } = STAGE_COLOR[stage];
  return <span style={{ ...PILL_STYLE, background: bg, color: fg }}>{STAGE_LABEL[stage]}</span>;
}
