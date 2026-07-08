// src/components/negotiation-simulator.tsx
// "Negotiation Simulator" — fusiona dos motores que ya existían, vistos en modo simulación:
// el Rule Engine de scoring (negotiation_levers) y la matriz de riesgo (risk_matrix_rules).
// Todo el cálculo es determinista y reutiliza computeRecommendation tal cual — nada de esto
// persiste hasta que se re-evalúa la propuesta de verdad; es un simulador, no una edición.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { computeRecommendation } from '@/application/use-cases/evaluation/build-evaluation-outcome';

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

interface RiskItem {
  factorId: string;
  name: string;
  level: string;
  impact: string;
}

interface RiskMatrixRule {
  level: string;
  impact: string;
  score: number;
}

const RISK_OPTIONS = ['Bajo', 'Medio', 'Alto'];

function riskLevelFromScore(score: number): string {
  return score >= 7 ? 'Alto' : score >= 4 ? 'Medio' : 'Bajo';
}

export function NegotiationSimulator({
  proposalId,
  totalScore,
  overallRiskLevel,
  currentScores,
  risks,
  riskMatrixRules,
}: {
  proposalId: string;
  totalScore: number;
  overallRiskLevel: string | null;
  currentScores: CurrentScore[];
  risks: RiskItem[];
  riskMatrixRules: RiskMatrixRule[];
}) {
  const [levers, setLevers] = useState<Lever[] | null>(null);
  const [selectedLevers, setSelectedLevers] = useState<Set<string>>(new Set());
  const [riskOverrides, setRiskOverrides] = useState<Record<string, { level: string; impact: string }>>({});

  useEffect(() => {
    fetch('/api/negotiation-levers')
      .then((res) => res.json())
      .then((data) => setLevers(Array.isArray(data) ? data : []))
      .catch(() => setLevers([]));
  }, []);

  const scoreByAttribute = useMemo(() => new Map(currentScores.map((s) => [s.attributeId, s.scoreValue])), [currentScores]);

  // ── Simulación de score (palancas de negociación) ──
  const leverGainByAttribute = useMemo(() => {
    const map = new Map<string, number>();
    if (!levers) return map;
    for (const lever of levers) {
      if (!selectedLevers.has(lever.id)) continue;
      const current = map.get(lever.scoring_attribute_id) ?? (scoreByAttribute.get(lever.scoring_attribute_id) ?? 0);
      const maxScore = lever.scoring_attributes?.max_score ?? 1;
      map.set(lever.scoring_attribute_id, Math.min(maxScore, current + Number(lever.score_delta)));
    }
    return map;
  }, [levers, selectedLevers, scoreByAttribute]);

  const scoreGain = useMemo(() => {
    let gain = 0;
    for (const [attributeId, newValue] of leverGainByAttribute.entries()) {
      gain += newValue - (scoreByAttribute.get(attributeId) ?? 0);
    }
    return gain;
  }, [leverGainByAttribute, scoreByAttribute]);

  const projectedScore = Math.min(1, totalScore + scoreGain);

  // ── Simulación de riesgo (nivel/impacto por factor) ──
  function findRuleScore(level: string, impact: string): number {
    return riskMatrixRules.find((r) => r.level === level && r.impact === impact)?.score ?? 0;
  }

  const projectedRiskScores = risks.map((r) => {
    const override = riskOverrides[r.factorId];
    const level = override?.level ?? r.level;
    const impact = override?.impact ?? r.impact;
    return findRuleScore(level, impact);
  });
  const projectedOverallRisk = projectedRiskScores.length ? riskLevelFromScore(Math.max(...projectedRiskScores)) : overallRiskLevel;

  const projectedRecommendation = computeRecommendation(projectedScore, projectedOverallRisk ?? 'Medio');
  const currentRecommendation = computeRecommendation(totalScore, overallRiskLevel ?? 'Medio');
  const recommendationChanged = projectedRecommendation !== currentRecommendation;

  function toggleLever(id: string) {
    setSelectedLevers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateRisk(factorId: string, field: 'level' | 'impact', value: string) {
    setRiskOverrides((prev) => ({
      ...prev,
      [factorId]: { level: prev[factorId]?.level ?? risks.find((r) => r.factorId === factorId)!.level, impact: prev[factorId]?.impact ?? risks.find((r) => r.factorId === factorId)!.impact, [field]: value },
    }));
  }

  if (levers === null) {
    return (
      <div className="card">
        <div className="card-title">Negotiation Simulator</div>
        <p style={{ fontSize: 13, color: 'var(--c-mid)' }}>Cargando catálogo de negociación...</p>
      </div>
    );
  }
  if (!levers.length && !risks.length) return null;

  const maxDelta = Math.max(1, ...(levers ?? []).map((l) => Number(l.score_delta)));

  return (
    <div className="card">
      <div className="card-title">Negotiation Simulator</div>
      <p style={{ fontSize: 12, color: 'var(--c-mid)', marginTop: 0, marginBottom: 16 }}>
        Simula palancas de negociación y cambios de riesgo — nada se guarda hasta que reevalúes la propuesta de verdad.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">Score actual</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{Math.round(totalScore * 100)}</div>
        </div>
        <div style={{ fontSize: 20, color: 'var(--c-mid)' }}>→</div>
        <div>
          <div className="stat-label">Nuevo score</div>
          <div className="stat-value" style={{ fontSize: 28, color: scoreGain > 0 ? 'var(--c-green)' : undefined }}>
            {Math.round(projectedScore * 100)}
            {scoreGain > 0 && <span style={{ fontSize: 14, marginLeft: 6 }}>↑ +{Math.round(scoreGain * 100)}</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="stat-label">Recomendación proyectada</div>
          <div className="stat-value" style={{ fontSize: 18, color: recommendationChanged ? 'var(--c-green)' : undefined }}>
            {projectedRecommendation}
            {recommendationChanged && <span style={{ fontSize: 11, display: 'block', color: 'var(--c-mid)' }}>antes: {currentRecommendation}</span>}
          </div>
        </div>
      </div>

      {levers.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 8 }}>Palancas de negociación</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: 16 }}>
            {levers.map((lever) => (
              <li key={lever.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-line)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={selectedLevers.has(lever.id)} onChange={() => toggleLever(lever.id)} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {lever.name} <span style={{ color: 'var(--c-green)', fontWeight: 700 }}>+{Math.round(Number(lever.score_delta) * 100)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-mid)' }}>
                    {lever.scoring_attributes?.scoring_blocks?.name} — {lever.scoring_attributes?.name}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 8 }}>Impacto de cada palanca</div>
          <div style={{ marginBottom: 20 }}>
            {[...levers]
              .sort((a, b) => Number(b.score_delta) - Number(a.score_delta))
              .map((lever) => (
                <div key={lever.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                    <span>{lever.name}</span>
                    <span>+{Math.round(Number(lever.score_delta) * 100)}</span>
                  </div>
                  <div style={{ background: 'var(--c-light)', borderRadius: 4, height: 6 }}>
                    <div
                      style={{
                        width: `${(Number(lever.score_delta) / maxDelta) * 100}%`,
                        background: 'var(--c-amber)',
                        height: 6,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {risks.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-mid)', marginBottom: 8, paddingTop: 12, borderTop: '1px solid var(--c-line)' }}>
            Sensibilidad de riesgo — ¿qué pasaría si cambiara...?
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {risks.map((r) => {
              const override = riskOverrides[r.factorId];
              return (
                <li key={r.factorId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12 }}>
                  <span style={{ flex: 1 }}>{r.name}</span>
                  <select value={override?.level ?? r.level} onChange={(e) => updateRisk(r.factorId, 'level', e.target.value)} style={{ padding: 3, fontSize: 11 }}>
                    {RISK_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        Nivel: {o}
                      </option>
                    ))}
                  </select>
                  <select value={override?.impact ?? r.impact} onChange={(e) => updateRisk(r.factorId, 'impact', e.target.value)} style={{ padding: 3, fontSize: 11 }}>
                    {RISK_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        Impacto: {o}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
