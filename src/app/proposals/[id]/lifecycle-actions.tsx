// src/app/proposals/[id]/lifecycle-actions.tsx
// El Decision Strip (enriquecido) ya gestiona Aprobar/Rechazar/Solicitar revisión.
// Esto solo cubre el único tramo que no está en esos botones: Aprobada → Finalizada.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LifecycleActionsProps {
  proposalId: string;
  approvedAt: string | null;
  finalizedAt: string | null;
}

export function LifecycleActions({ proposalId, approvedAt, finalizedAt }: LifecycleActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!approvedAt || finalizedAt) return null;

  async function handleFinalize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/finalize`, { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al finalizar la propuesta.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <button className="btn btn-amber" onClick={handleFinalize} disabled={loading}>
        {loading ? 'Guardando...' : 'Finalizar'}
      </button>
      {error && <p style={{ color: 'crimson', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
