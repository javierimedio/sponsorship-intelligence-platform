// src/components/negotiation-assistant.tsx
// "Cómo mejorar esta propuesta" — checklist de palancas del catálogo (nunca texto libre
// de IA). El score proyectado se calcula en el cliente sumando las palancas marcadas,
// capado al max_score de cada atributo. No persiste nada — es un simulador, no una edición
// real de la evaluación (para aplicar de verdad un cambio, se edita la propuesta).
'use client';

import { useEffect, useMemo, useState } from 'react';

interface Lever {
  id: string;
  name: string;
  description: string | null;
  score_delta: number;
  scoring_attribute_id: string;
  scoring_attributes: { name: string; max_score: number; scoring_blocks: { name: string } } | null;
}

interface CurrentScore {
  attributeId: string;
  scoreValue: number;
}

export function NegotiationAssistant({ proposalId, totalScore, currentScores }: { proposalId: string; totalScore: number; currentScores: CurrentScore[] }) {
  const [levers, setLevers] = useState<Lever[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/negotiation-levers')
      .then((res) => res.json())
      .then((data) => setLevers(Array.isArray(data) ? data : []))
      .catch(() => setLevers([]));
  }, []);

  const scoreByAttribute = useMemo(() => new Map(currentScores.map((s) => [s.attributeId, s.scoreValue])), [currentScores]);

  const projectedGain = useMemo(() => {
    if (!levers) return 0;
    // Varias palancas pueden apuntar al mismo atributo — el capado se hace por atributo,
    // no por palanca suelta, para no proyectar más de lo que el propio máximo permite.
    const gainByAttribute = new Map<string, number>();
    for (const lever of levers) {
      if (!selected.has(lever.id)) continue;
      const current = gainByAttribute.get(lever.scoring_attribute_id) ?? (scoreByAttribute.get(lever.scoring_attribute_id) ?? 0);
      const maxScore = lever.scoring_attributes?.max_score ?? 1;
      const next = Math.min(maxScore, current + Number(lever.score_delta));
      gainByAttribute.set(lever.scoring_attribute_id, next);
    }
    let totalGain = 0;
    for (const [attributeId, newValue] of gainByAttribute.entries()) {
      const original = scoreByAttribute.get(attributeId) ?? 0;
      totalGain += newValue - original;
    }
    return totalGain;
  }, [levers, selected, scoreByAttribute]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (levers === null) {
    return (
      <div className="card">
        <div className="card-title">Cómo mejorar esta propuesta</div>
        <p style={{ fontSize: 13, color: 'var(--c-mid)' }}>Cargando catálogo de negociación...</p>
      </div>
    );
  }

  if (!levers.length) {
    return null; // sin catálogo configurado para esta organización — no mostramos una caja vacía
  }

  const projectedScore = Math.min(1, totalScore + projectedGain);

  return (
    <div className="card">
      <div className="card-title">Cómo mejorar esta propuesta</div>
      <p style={{ fontSize: 12, color: 'var(--c-mid)', marginTop: 0, marginBottom: 12 }}>
        Marca las palancas que negociarías — es una simulación, no cambia la evaluación real hasta que la vuelvas a calcular.
      </p>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {levers.map((lever) => (
          <li key={lever.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-line)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={selected.has(lever.id)} onChange={() => toggle(lever.id)} style={{ marginTop: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {lever.name} <span style={{ color: 'var(--c-green)', fontWeight: 700 }}>+{Math.round(Number(lever.score_delta) * 100)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-mid)' }}>
                {lever.scoring_attributes?.scoring_blocks?.name} — {lever.scoring_attributes?.name}
                {lever.description ? ` · ${lever.description}` : ''}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--c-line)' }}>
        <div>
          <div className="stat-label">Score actual</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{Math.round(totalScore * 100)}%</div>
        </div>
        <div>
          <div className="stat-label">Score proyectado</div>
          <div className="stat-value" style={{ fontSize: 20, color: selected.size ? 'var(--c-green)' : undefined }}>
            {Math.round(projectedScore * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}
