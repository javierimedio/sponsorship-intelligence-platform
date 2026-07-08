// src/components/metric-card.tsx
// Primitiva del Design System: cualquier "cifra con etiqueta" del producto pasa por aquí
// (Dashboard, Analytics futuro, Workspace). Sustituye a los <div className="kpi-card"> ad-hoc.

interface MetricCardProps {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative';
  hint?: string;
}

const TONE_COLOR: Record<string, string> = {
  neutral: 'var(--c-dark)',
  positive: 'var(--c-green)',
  warning: 'var(--c-amber)',
  negative: 'var(--c-red)',
};

export function MetricCard({ label, value, tone = 'neutral', hint }: MetricCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-value" style={{ color: TONE_COLOR[tone] }}>
        {value}
      </div>
      <div className="kpi-label">{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--c-mid)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/** Alias semántico: misma primitiva, nombre distinto para la tira de KPIs del Dashboard. */
export function KPICard(props: MetricCardProps) {
  return <MetricCard {...props} />;
}
