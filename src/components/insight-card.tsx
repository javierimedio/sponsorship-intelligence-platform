// src/components/insight-card.tsx
// Variante en tarjeta del tinte exclusivo de IA (mismo principio que AIInsightPanel):
// para bloques más prominentes como el Executive Summary del Dashboard.

export function InsightCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ai-tint" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, opacity: 0.75 }}>
        🤖 {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
