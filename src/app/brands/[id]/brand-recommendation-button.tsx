// src/app/brands/[id]/brand-recommendation-button.tsx
'use client';

import { useState } from 'react';

interface Props {
  brandName: string;
  positioning: string | null;
  idealCollaborations: string[] | null;
  avoidCollaborations: string[] | null;
  strategicPriorities: string[] | null;
  evaluationBias: string | null;
  decisionStyle: string | null;
  historicalBreakdown: { collaborationType: string; count: number; avgScore: number }[];
}

export function BrandRecommendationButton(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/brand-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al generar la recomendación.');
      setRecommendation(data.recommendation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Recomendación estratégica con IA</div>
      <p style={{ fontSize: 12, color: 'var(--c-mid)', marginTop: 0 }}>
        Combina el ADN de marca y el histórico real de arriba (y puede buscar en internet) para sugerir qué tipo de
        patrocinios buscar. Tiene coste — por eso es un botón explícito, no algo automático.
      </p>
      <button onClick={handleGenerate} disabled={loading} className="btn btn-amber" style={{ fontSize: 13 }}>
        {loading ? 'Generando (puede tardar unos segundos)...' : '✨ Generar recomendación estratégica (OpenAI)'}
      </button>
      {error && <p style={{ color: 'crimson', fontSize: 12, marginTop: 8 }}>{error}</p>}
      {recommendation && (
        <div className="ai-tint" style={{ marginTop: 12, padding: 14, borderRadius: 'var(--radius)', whiteSpace: 'pre-wrap', fontSize: 13 }}>
          {recommendation}
        </div>
      )}
    </div>
  );
}
