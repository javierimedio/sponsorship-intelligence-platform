// src/components/ai-insight-panel.tsx
// Tinte lavanda exclusivo para texto redactado/interpretado por IA (Documento 6, §4) —
// nunca se usa para nada más, es la señal visual de "esto lo escribió el analista".

export function AIInsightPanel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="ai-tint">
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, opacity: 0.75 }}>
        🤖 {title ?? 'Análisis'}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
