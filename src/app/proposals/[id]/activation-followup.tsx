// src/app/proposals/[id]/activation-followup.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'done', label: 'Hecho' },
  { value: 'cancelled', label: 'Cancelado' },
];

export function ActivationFollowUp({
  actionId,
  currentStatus,
  currentKpiResult,
}: {
  actionId: string;
  currentStatus: string;
  currentKpiResult: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [kpiResult, setKpiResult] = useState(currentKpiResult ?? '');
  const [saving, setSaving] = useState(false);

  async function save(nextStatus: string, nextKpiResult: string) {
    setSaving(true);
    try {
      await fetch(`/api/activations/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, kpiResult: nextKpiResult || null }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        value={status}
        disabled={saving}
        onChange={(e) => {
          setStatus(e.target.value);
          save(e.target.value, kpiResult);
        }}
        style={{ fontSize: 11, padding: 3 }}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={kpiResult}
        disabled={saving}
        placeholder="Resultado KPI"
        onChange={(e) => setKpiResult(e.target.value)}
        onBlur={() => save(status, kpiResult)}
        style={{ fontSize: 11, padding: 3, width: 100 }}
      />
    </div>
  );
}
