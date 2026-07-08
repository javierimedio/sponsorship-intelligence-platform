// src/app/proposals/[id]/submit-button.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SubmitProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/submit`, { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar la propuesta.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <button className="btn btn-amber" onClick={handleClick} disabled={loading}>
        {loading ? 'Enviando...' : '✅ Enviar propuesta'}
      </button>
      {error && <p style={{ color: 'crimson', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
