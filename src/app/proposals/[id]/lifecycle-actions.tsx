// src/app/proposals/[id]/lifecycle-actions.tsx
// Un único botón que avanza la propuesta al siguiente estado del ciclo de vida
// (Documento 6, §5): Enviar → Aprobar → Finalizar. Sustituye al antiguo SubmitProposalButton
// aislado — ahora es un único componente que sabe en qué punto está la propuesta.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LifecycleActionsProps {
  proposalId: string;
  hasRecommendation: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  finalizedAt: string | null;
}

export function LifecycleActions({ proposalId, hasRecommendation, submittedAt, approvedAt, finalizedAt }: LifecycleActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'submit' | 'approve' | 'finalize') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/${action}`, { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar la propuesta.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  let button: { label: string; action: 'submit' | 'approve' | 'finalize' } | null = null;
  if (!hasRecommendation) {
    button = null;
  } else if (!submittedAt) {
    button = { label: 'Enviar propuesta', action: 'submit' };
  } else if (!approvedAt) {
    button = { label: 'Aprobar', action: 'approve' };
  } else if (!finalizedAt) {
    button = { label: 'Finalizar', action: 'finalize' };
  }

  if (!button) return null;

  return (
    <div style={{ display: 'inline-block' }}>
      <button className="btn btn-amber" onClick={() => run(button!.action)} disabled={loading}>
        {loading ? 'Guardando...' : button.label}
      </button>
      {error && <p style={{ color: 'crimson', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
