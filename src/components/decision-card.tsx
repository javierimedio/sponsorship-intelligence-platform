// src/components/decision-card.tsx
// Sustituye las filas de lista para "propuestas prioritarias" del Dashboard por tarjetas
// visuales — logo/nombre/score/riesgo/recomendación/CTA, tal como se pide.

import Link from 'next/link';
import { ConfidenceRing } from './confidence-ring';
import { RiskBadge } from './badges';

const RECOMMENDATION_COLOR: Record<string, string> = {
  Recomendable: 'var(--c-green)',
  Táctico: 'var(--c-amber)',
  'No recomendable': 'var(--c-red)',
};

interface DecisionCardProps {
  proposalId: string;
  title: string;
  brandName: string;
  totalScore: number | null;
  overallRiskLevel: string | null;
  recommendation: string | null;
}

export function DecisionCard({ proposalId, title, brandName, totalScore, overallRiskLevel, recommendation }: DecisionCardProps) {
  return (
    <div
      className="card"
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '1rem 1.25rem', marginBottom: 10 }}
    >
      <ConfidenceRing totalScore={totalScore} overallRiskLevel={overallRiskLevel} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-mid)' }}>{brandName}</div>
      </div>
      <RiskBadge level={overallRiskLevel} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: recommendation ? RECOMMENDATION_COLOR[recommendation] ?? 'inherit' : 'var(--c-mid)',
          minWidth: 100,
          textAlign: 'right',
        }}
      >
        {recommendation ?? '—'}
      </span>
      <Link href={`/proposals/${proposalId}`} className="btn btn-outline" style={{ padding: '.4rem .8rem', fontSize: 12 }}>
        Ver →
      </Link>
    </div>
  );
}
