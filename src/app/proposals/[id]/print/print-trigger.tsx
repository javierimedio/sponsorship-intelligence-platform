// src/app/proposals/[id]/print/print-trigger.tsx
'use client';

export function PrintTrigger() {
  return (
    <div className="print-hide" style={{ padding: 16, textAlign: 'center', background: '#F1EFE8' }}>
      <button className="btn btn-amber" onClick={() => window.print()}>
        🖨️ Imprimir / Guardar como PDF
      </button>
    </div>
  );
}
