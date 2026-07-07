// src/app/intake/intake-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';

interface IntakeFormProps {
  organizationId: string;
}

type Step = 'idle' | 'creating-proposal' | 'uploading' | 'registering' | 'done' | 'error';

export function IntakeForm({ organizationId }: IntakeFormProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setStep('error');
      setMessage('El título es obligatorio.');
      return;
    }

    try {
      // 1. Crear la propuesta (Route Handler → caso de uso → Supabase)
      setStep('creating-proposal');
      const proposalRes = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const proposal = await proposalRes.json();
      if (!proposalRes.ok) throw new Error(proposal.error ?? 'Error al crear la propuesta.');

      if (!file) {
        setStep('done');
        setMessage(`Propuesta "${proposal.title}" creada (sin documento adjunto).`);
        return;
      }

      // 2. Subir el archivo directamente a Storage — la RLS de storage.objects
      //    exige que el primer segmento de la ruta sea tu organization_id.
      setStep('uploading');
      const supabase = createSupabaseBrowserClient();
      const storagePath = `${organizationId}/${proposal.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // 3. Registrar los metadatos del documento
      setStep('registering');
      const documentRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          storagePath,
          originalFilename: file.name,
        }),
      });
      const document = await documentRes.json();
      if (!documentRes.ok) throw new Error(document.error ?? 'Error al registrar el documento.');

      setStep('done');
      setMessage(`Propuesta "${proposal.title}" creada con el documento "${file.name}" adjunto.`);
      setTitle('');
      setFile(null);
    } catch (error) {
      setStep('error');
      setMessage((error as Error).message);
    }
  }

  const loading = step === 'creating-proposal' || step === 'uploading' || step === 'registering';
  const stepLabel: Record<Step, string> = {
    idle: '',
    'creating-proposal': 'Creando propuesta...',
    uploading: 'Subiendo documento a Storage...',
    registering: 'Registrando metadatos...',
    done: '',
    error: '',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Título de la propuesta
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ej: Patrocinio Club Deportivo X — 2026"
          style={{ width: '100%', padding: 8 }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Documento (opcional, PDF/imagen)
        </label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <button type="submit" disabled={loading} style={{ padding: '8px 16px', width: 'fit-content' }}>
        {loading ? stepLabel[step] : 'Crear propuesta'}
      </button>

      {message && (
        <p style={{ color: step === 'error' ? 'crimson' : 'green', fontSize: 13 }}>{message}</p>
      )}
    </form>
  );
}
