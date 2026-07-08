// src/components/reject-dialog.tsx
// Sustituye a window.prompt() — mismo dato final (un texto de motivo), presentación
// profesional. Preparado para crecer (etiquetas, comentarios, rechazo temporal) sin
// cambiar la UX, tal como se pidió.
'use client';

import { useState } from 'react';

const QUICK_REASONS = ['Presupuesto elevado', 'Sin encaje estratégico', 'Riesgo elevado', 'Audiencia no relevante'];

interface RejectDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

export function RejectDialog({ open, onCancel, onConfirm, loading }: RejectDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (!open) return null;

  function pick(option: string) {
    setSelected(option);
    setReason(option === 'Otro' ? '' : option);
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Rechazar propuesta</h3>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Motivo del rechazo</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {QUICK_REASONS.concat('Otro').map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" name="reject-reason" checked={selected === opt} onChange={() => pick(opt)} />
              {opt}
            </label>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Detalle adicional (opcional)"
          style={{ width: '100%' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{ background: 'var(--c-red)', color: 'white' }}
            onClick={() => onConfirm(reason)}
            disabled={loading}
          >
            {loading ? 'Rechazando...' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  );
}
