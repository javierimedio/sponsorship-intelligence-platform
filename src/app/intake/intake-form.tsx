// src/app/intake/intake-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';

interface IntakeFormProps {
  organizationId: string;
  manualMode: boolean;
}

type Phase =
  | 'input'
  | 'creating-proposal'
  | 'uploading'
  | 'registering'
  | 'extracting'
  | 'evaluating'
  | 'manual-extract'
  | 'manual-evaluate'
  | 'saving-manual-extraction'
  | 'saving-manual-evaluation'
  | 'done'
  | 'error';

interface CatalogAttribute {
  id: string;
  blockName: string;
  name: string;
  maxScore: number;
}
interface CatalogRiskFactor {
  id: string;
  blockName: string;
  name: string;
}
interface CatalogConcept {
  id: string;
  name: string;
  nature: 'cost' | 'result';
}
interface Catalog {
  scoringAttributes: CatalogAttribute[];
  riskFactors: CatalogRiskFactor[];
  economicConcepts: CatalogConcept[];
}

interface EvaluationResult {
  totalScore: number;
  overallRiskLevel: string;
  recommendation: string;
  scores: { attributeId: string; scoreValue: number; rationale: string }[];
  risks: { factorId: string; level: string; impact: string; computedScore: number }[];
  financials: { conceptId: string; estimatedAmount: number | null }[];
}

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  'creating-proposal': 'Creando propuesta...',
  uploading: 'Subiendo documento a Storage...',
  registering: 'Registrando metadatos...',
  extracting: 'Agente 1 leyendo el documento...',
  evaluating: 'Agentes 2/3/5 evaluando (scoring, riesgo, financials)...',
  'saving-manual-extraction': 'Guardando extracción manual...',
  'saving-manual-evaluation': 'Calculando y guardando evaluación...',
};

const RISK_OPTIONS = ['Bajo', 'Medio', 'Alto'];

// Supabase Storage no admite espacios ni caracteres acentuados en la ruta del objeto.
function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export function IntakeForm({ organizationId, manualMode }: IntakeFormProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);

  // Estado que sobrevive entre pasos del modo manual
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  // Formulario de extracción manual
  const [manualRequesterName, setManualRequesterName] = useState('');
  const [manualRequesterOrg, setManualRequesterOrg] = useState('');
  const [manualCollaborationType, setManualCollaborationType] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  // Formulario de evaluación manual: valores por id de catálogo
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [manualRisks, setManualRisks] = useState<Record<string, { level: string; impact: string }>>({});
  const [manualFinancials, setManualFinancials] = useState<Record<string, string>>({});

  const loading = [
    'creating-proposal',
    'uploading',
    'registering',
    'extracting',
    'evaluating',
    'saving-manual-extraction',
    'saving-manual-evaluation',
  ].includes(phase);

  async function handleInitialSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setResult(null);
    setExtractedSummary(null);

    if (!title.trim()) {
      setPhase('error');
      setMessage('El título es obligatorio.');
      return;
    }
    if (!file) {
      setPhase('error');
      setMessage('Sube un documento — hace falta para la extracción, automática o manual.');
      return;
    }

    try {
      // 1. Crear la propuesta
      setPhase('creating-proposal');
      const proposalRes = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const proposal = await proposalRes.json();
      if (!proposalRes.ok) throw new Error(proposal.error ?? 'Error al crear la propuesta.');
      setProposalId(proposal.id);

      // 2. Subir el archivo directamente a Storage
      setPhase('uploading');
      const supabase = createSupabaseBrowserClient();
      const storagePath = `${organizationId}/${proposal.id}/${Date.now()}_${sanitizeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file);
      if (uploadError) throw uploadError;

      // 3. Registrar los metadatos del documento
      setPhase('registering');
      const documentRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, storagePath, originalFilename: file.name }),
      });
      const document = await documentRes.json();
      if (!documentRes.ok) throw new Error(document.error ?? 'Error al registrar el documento.');
      setDocumentId(document.id);

      if (manualMode) {
        // Pasamos al formulario de extracción manual — nada de IA todavía.
        setPhase('manual-extract');
        return;
      }

      // Camino automático: Agente 1 → Agentes 2/3/5, encadenados.
      setPhase('extracting');
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

      setPhase('evaluating');
      const evaluationRes = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const evaluation = await evaluationRes.json();
      if (!evaluationRes.ok) throw new Error(evaluation.error ?? 'Error en la evaluación.');

      setResult(evaluation);
      setPhase('done');
      setMessage(`Propuesta "${proposal.title}" extraída y evaluada correctamente.`);
      setTitle('');
      setFile(null);
    } catch (error) {
      setPhase('error');
      setMessage((error as Error).message);
    }
  }

  async function handleManualExtractionSubmit(event: FormEvent) {
    event.preventDefault();
    if (!proposalId) return;

    try {
      setPhase('saving-manual-extraction');

      const extractedJson = {
        requester_name: manualRequesterName || null,
        requester_org: manualRequesterOrg || null,
        collaboration_type: manualCollaborationType || null,
        summary: manualSummary,
        assets_offered: [],
        estimated_total_amount: manualAmount ? Number(manualAmount) : null,
        currency: 'EUR',
        opportunities: [],
        risks: [],
      };

      const res = await fetch('/api/extractions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, documentId, extractedJson }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar la extracción manual.');

      setExtractedSummary(manualSummary || null);

      // Cargar el catálogo de la organización para dibujar el formulario de evaluación
      const catalogRes = await fetch('/api/catalog');
      const catalogData = await catalogRes.json();
      if (!catalogRes.ok) throw new Error(catalogData.error ?? 'Error al cargar el catálogo.');
      setCatalog(catalogData);

      setPhase('manual-evaluate');
    } catch (error) {
      setPhase('error');
      setMessage((error as Error).message);
    }
  }

  async function handleManualEvaluationSubmit(event: FormEvent) {
    event.preventDefault();
    if (!proposalId || !catalog) return;

    try {
      setPhase('saving-manual-evaluation');

      const scores = catalog.scoringAttributes.map((a) => ({
        attributeId: a.id,
        score: Math.min(Number(manualScores[a.id] ?? 0), a.maxScore),
        rationale: 'Puntuación introducida manualmente.',
      }));

      const risks = catalog.riskFactors.map((f) => ({
        factorId: f.id,
        level: manualRisks[f.id]?.level ?? 'Bajo',
        impact: manualRisks[f.id]?.impact ?? 'Bajo',
      }));

      const financials = catalog.economicConcepts.map((c) => ({
        conceptId: c.id,
        estimatedAmount: manualFinancials[c.id] ? Number(manualFinancials[c.id]) : null,
      }));

      const res = await fetch('/api/evaluations/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, scores, risks, financials }),
      });
      const evaluation = await res.json();
      if (!res.ok) throw new Error(evaluation.error ?? 'Error al evaluar manualmente.');

      setResult(evaluation);
      setPhase('done');
      setMessage('Propuesta evaluada manualmente (source="manual").');
    } catch (error) {
      setPhase('error');
      setMessage((error as Error).message);
    }
  }

  return (
    <div>
      {phase === 'input' || loading ? (
        <form onSubmit={handleInitialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
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
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Documento (PDF/imagen) — {manualMode ? 'para archivo, tú introduces los datos a mano' : 'la IA lo leerá'}
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} style={{ padding: '8px 16px', width: 'fit-content' }}>
            {loading ? PHASE_LABEL[phase] : manualMode ? 'Crear propuesta →' : 'Crear, extraer y evaluar'}
          </button>
        </form>
      ) : null}

      {phase === 'manual-extract' && (
        <form onSubmit={handleManualExtractionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
          <h2 style={{ fontSize: 15 }}>Extracción manual (equivalente al Agente 1)</h2>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Solicitante (persona)</label>
            <input type="text" value={manualRequesterName} onChange={(e) => setManualRequesterName(e.target.value)} style={{ width: '100%', padding: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Organización solicitante</label>
            <input type="text" value={manualRequesterOrg} onChange={(e) => setManualRequesterOrg(e.target.value)} style={{ width: '100%', padding: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tipo de colaboración</label>
            <input type="text" value={manualCollaborationType} onChange={(e) => setManualCollaborationType(e.target.value)} placeholder="ej: Patrocinio deportivo" style={{ width: '100%', padding: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Resumen</label>
            <textarea value={manualSummary} onChange={(e) => setManualSummary(e.target.value)} rows={3} style={{ width: '100%', padding: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Importe total estimado (€)</label>
            <input type="number" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} style={{ width: '100%', padding: 6 }} />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '8px 16px', width: 'fit-content' }}>
            {loading ? PHASE_LABEL[phase] : 'Guardar extracción y continuar →'}
          </button>
        </form>
      )}

      {phase === 'manual-evaluate' && catalog && (
        <form onSubmit={handleManualEvaluationSubmit} style={{ marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Evaluación manual (equivalente a los Agentes 2/3/5)</h2>

          <h3 style={{ fontSize: 13, marginTop: 16 }}>Scoring por atributo</h3>
          {catalog.scoringAttributes.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 12, flex: 1 }}>
                {a.blockName} — {a.name} (máx. {a.maxScore})
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={a.maxScore}
                value={manualScores[a.id] ?? ''}
                onChange={(e) => setManualScores((prev) => ({ ...prev, [a.id]: e.target.value }))}
                style={{ width: 90, padding: 4 }}
              />
            </div>
          ))}

          <h3 style={{ fontSize: 13, marginTop: 16 }}>Factores de riesgo</h3>
          {catalog.riskFactors.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 12, flex: 1 }}>
                {f.blockName} — {f.name}
              </label>
              <select
                value={manualRisks[f.id]?.level ?? 'Bajo'}
                onChange={(e) =>
                  setManualRisks((prev) => ({ ...prev, [f.id]: { ...prev[f.id], level: e.target.value, impact: prev[f.id]?.impact ?? 'Bajo' } }))
                }
                style={{ padding: 4 }}
              >
                {RISK_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    Nivel: {opt}
                  </option>
                ))}
              </select>
              <select
                value={manualRisks[f.id]?.impact ?? 'Bajo'}
                onChange={(e) =>
                  setManualRisks((prev) => ({ ...prev, [f.id]: { level: prev[f.id]?.level ?? 'Bajo', impact: e.target.value } }))
                }
                style={{ padding: 4 }}
              >
                {RISK_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    Impacto: {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <h3 style={{ fontSize: 13, marginTop: 16 }}>Conceptos económicos (€)</h3>
          {catalog.economicConcepts.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 12, flex: 1 }}>
                {c.name} ({c.nature === 'cost' ? 'coste' : 'resultado'})
              </label>
              <input
                type="number"
                value={manualFinancials[c.id] ?? ''}
                onChange={(e) => setManualFinancials((prev) => ({ ...prev, [c.id]: e.target.value }))}
                style={{ width: 120, padding: 4 }}
              />
            </div>
          ))}

          <button type="submit" disabled={loading} style={{ marginTop: 16, padding: '8px 16px' }}>
            {loading ? PHASE_LABEL[phase] : 'Calcular evaluación →'}
          </button>
        </form>
      )}

      {message && <p style={{ color: phase === 'error' ? 'crimson' : 'green', fontSize: 13, marginTop: 12 }}>{message}</p>}

      {extractedSummary && (
        <div style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <strong style={{ fontSize: 12 }}>Resumen extraído:</strong>
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
