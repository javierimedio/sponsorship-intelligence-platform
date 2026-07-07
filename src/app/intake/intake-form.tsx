// src/app/intake/intake-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';

interface IntakeFormProps {
  organizationId: string;
}

type Step =
  | 'idle'
  | 'creating-proposal'
  | 'uploading'
  | 'registering'
  | 'extracting'
  | 'evaluating'
  | 'done'
  | 'error';

interface EvaluationResult {
  totalScore: number;
  overallRiskLevel: string;
  recommendation: string;
  scores: { attributeId: string; scoreValue: number; rationale: string }[];
  risks: { factorId: string; level: string; impact: string; computedScore: number }[];
  financials: { conceptId: string; estimatedAmount: number | null }[];
}

const STEP_LABEL: Record<Step, string> = {
  idle: '',
  'creating-proposal': 'Creando propuesta...',
  uploading: 'Subiendo documento a Storage...',
  registering: 'Registrando metadatos...',
  extracting: 'Agente 1 leyendo el documento...',
  evaluating: 'Agentes 2/3/5 evaluando (scoring, riesgo, financials)...',
  done: '',
  error: '',
};

// Supabase Storage no admite espacios ni caracteres acentuados en la ruta del objeto.
// El nombre "bonito" original se guarda igualmente en `documents.original_filename`
// para mostrarlo en la UI — esto solo afecta a la ruta física del archivo.
function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos (á→a, ó→o, ñ se trata aparte abajo)
    .replace(/[^a-zA-Z0-9.\-_]/g, '_'); // cualquier otro carácter (espacios, ñ, etc.) → "_"
}

export function IntakeForm({ organizationId }: IntakeFormProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setResult(null);
    setExtractedSummary(null);

    if (!title.trim()) {
      setStep('error');
      setMessage('El título es obligatorio.');
      return;
    }
    if (!file) {
      setStep('error');
      setMessage('Sube un documento — es necesario para que la IA pueda evaluar la propuesta.');
      return;
    }

    try {
      // 1. Crear la propuesta
      setStep('creating-proposal');
      const proposalRes = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const proposal = await proposalRes.json();
      if (!proposalRes.ok) throw new Error(proposal.error ?? 'Error al crear la propuesta.');

      // 2. Subir el archivo directamente a Storage
      setStep('uploading');
      const supabase = createSupabaseBrowserClient();
      const storagePath = `${organizationId}/${proposal.id}/${Date.now()}_${sanitizeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file);
      if (uploadError) throw uploadError;

      // 3. Registrar los metadatos del documento
      setStep('registering');
      const documentRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, storagePath, originalFilename: file.name }),
      });
      const document = await documentRes.json();
      if (!documentRes.ok) throw new Error(document.error ?? 'Error al registrar el documento.');

      // 4. Agente 1 — Extracción
      setStep('extracting');
      const extractionRes = await fetch('/api/extractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, documentId: document.id, storagePath }),
      });
      const extraction = await extractionRes.json();
      if (!extractionRes.ok) throw new Error(extraction.error ?? 'Error en la extracción.');
      setExtractedSummary(
        typeof extraction.extractedJson?.summary === 'string' ? extraction.extractedJson.summary : null,
      );

      // 5. Agentes 2/3/5 — Evaluación
      setStep('evaluating');
      const evaluationRes = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const evaluation = await evaluationRes.json();
      if (!evaluationRes.ok) throw new Error(evaluation.error ?? 'Error en la evaluación.');

      setResult(evaluation);
      setStep('done');
      setMessage(`Propuesta "${proposal.title}" extraída y evaluada correctamente.`);
      setTitle('');
      setFile(null);
    } catch (error) {
      setStep('error');
      setMessage((error as Error).message);
    }
  }

  const loading = ['creating-proposal', 'uploading', 'registering', 'extracting', 'evaluating'].includes(step);

  return (
    <div>
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
            Documento (PDF/imagen) — obligatorio, la IA necesita leerlo
          </label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '8px 16px', width: 'fit-content' }}>
          {loading ? STEP_LABEL[step] : 'Crear, extraer y evaluar'}
        </button>

        {message && <p style={{ color: step === 'error' ? 'crimson' : 'green', fontSize: 13 }}>{message}</p>}
      </form>

      {extractedSummary && (
        <div style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <strong style={{ fontSize: 12 }}>Resumen extraído por el Agente 1:</strong>
          <p style={{ fontSize: 13, marginTop: 4 }}>{extractedSummary}</p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Resultado de la evaluación</h2>

          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>SCORE TOTAL</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{(result.totalScore * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>RIESGO GLOBAL</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{result.overallRiskLevel}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>RECOMENDACIÓN</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{result.recommendation}</div>
            </div>
          </div>

          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Scoring por atributo ({result.scores.length})
            </summary>
            <ul style={{ fontSize: 12, marginTop: 8 }}>
              {result.scores.map((s) => (
                <li key={s.attributeId} style={{ marginBottom: 4 }}>
                  {s.scoreValue.toFixed(3)} — {s.rationale}
                </li>
              ))}
            </ul>
          </details>

          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Factores de riesgo ({result.risks.length})
            </summary>
            <ul style={{ fontSize: 12, marginTop: 8 }}>
              {result.risks.map((r) => (
                <li key={r.factorId} style={{ marginBottom: 4 }}>
                  Nivel {r.level} / Impacto {r.impact} → puntuación {r.computedScore}
                </li>
              ))}
            </ul>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Líneas financieras ({result.financials.length})
            </summary>
            <ul style={{ fontSize: 12, marginTop: 8 }}>
              {result.financials.map((f) => (
                <li key={f.conceptId} style={{ marginBottom: 4 }}>
                  {f.estimatedAmount !== null ? `${f.estimatedAmount.toLocaleString('es-ES')} €` : 'Sin datos suficientes'}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
