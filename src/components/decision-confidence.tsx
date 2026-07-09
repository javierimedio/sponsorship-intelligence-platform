// src/components/decision-confidence.tsx

import { DecisionQuality } from '@/lib/decision-quality';

export function DecisionConfidenceCard({ quality }: { quality: DecisionQuality }) {
  const color = quality.confidencePct >= 75 ? 'var(--c-green)' : quality.confidencePct >= 50 ? 'var(--c-amber)' : 'var(--c-red)';

  return (
    <div className="card">
      <div className="card-title">Confianza de la recomendación</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1, background: 'var(--c-light)', borderRadius: 4, height: 10 }}>
          <div style={{ width: `${quality.confidencePct}%`, background: color, height: 10, borderRadius: 4 }} />
        </div>
        <strong style={{ fontSize: 16, color }}>{quality.confidencePct}%</strong>
      </div>
      <p style={{ fontSize: 12, color, fontWeight: 700, margin: '0 0 10px' }}>{quality.confidenceLabel}</p>
      <p style={{ fontSize: 11, color: 'var(--c-mid)', margin: '0 0 8px' }}>
        Mide la calidad de la evaluación (cobertura de datos), no la IA.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
        {quality.checks.map((c) => (
          <li key={c.label} style={{ padding: '3px 0', color: c.passed ? 'var(--c-green)' : 'var(--c-mid)' }}>
            {c.passed ? '✓' : '✗'} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
