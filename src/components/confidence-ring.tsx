// src/components/confidence-ring.tsx
// El elemento de identidad visual más reconocible del producto (Documento 6, §4).
// Combina score y riesgo en un único color — no son dos badges de texto sueltos.

import { getTone } from '@/lib/workspace-stage';

interface ConfidenceRingProps {
  totalScore: number | null;
  overallRiskLevel: string | null;
  size?: 'sm' | 'lg';
}

const TONE_COLOR: Record<string, string> = {
  positive: 'var(--c-green)',
  warning: 'var(--c-amber)',
  negative: 'var(--c-red)',
  neutral: 'var(--c-mid)',
};

export function ConfidenceRing({ totalScore, overallRiskLevel, size = 'sm' }: ConfidenceRingProps) {
  const dimension = size === 'lg' ? 72 : 40;
  const stroke = size === 'lg' ? 6 : 4;
  const radius = dimension / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const pct = totalScore ?? 0;
  const dash = circumference * pct;
  const tone = getTone({ totalScore, overallRiskLevel });
  const color = TONE_COLOR[tone];

  return (
    <div style={{ position: 'relative', width: dimension, height: dimension, flexShrink: 0 }}>
      <svg width={dimension} height={dimension} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} stroke="var(--c-line)" strokeWidth={stroke} fill="none" />
        {totalScore !== null && (
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size === 'lg' ? 16 : 11,
          fontWeight: 700,
          color: totalScore !== null ? color : 'var(--c-mid)',
        }}
      >
        {totalScore !== null ? `${Math.round(totalScore * 100)}` : '—'}
      </div>
    </div>
  );
}
