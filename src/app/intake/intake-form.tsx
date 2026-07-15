// src/app/intake/intake-form.tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';

interface EditingExtraction {
  requesterName: string;
  requesterOrg: string;
  collaborationType: string;
  summary: string;
  amount: string;
  website: string;
  facebook: string;
  instagram: string;
  youtube: string;
  /** Uno por línea en el textarea — se convierten a array al guardar. Sin estos, el
   *  motor de evaluación (Agentes 2-5) apenas tiene con qué trabajar más allá del
   *  resumen: "no se proporciona información" en casi todos los atributos y riesgos. */
  assetsOffered: string;
  opportunities: string;
  risks: string;
}

export interface EditingData {
  proposalId: string;
  documentId: string | null;
  title: string;
  brandId: string | null;
  extraction: EditingExtraction | null;
  scores: Record<string, string>;
  risks: Record<string, { level: string; impact: string }>;
  financials: Record<string, string>;
}

interface IntakeFormProps {
  organizationId: string;
  defaultProvider: string;
  editing?: EditingData;
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

interface Brand {
  id: string;
  name: string;
}

interface AIProviderOption {
  id: string;
  label: string;
  configured: boolean;
}

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
  nature: 'cost' | 'result' | 'resource';
  blockType: string | null;
}
interface Catalog {
  scoringAttributes: CatalogAttribute[];
  riskFactors: CatalogRiskFactor[];
  economicConcepts: CatalogConcept[];
}

interface ActivationCatalogItem {
  id: string;
  area: string;
  name: string;
}
interface NamedItem {
  id: string;
  name: string;
}
interface ActivationCatalogData {
  items: ActivationCatalogItem[];
  channels: NamedItem[];
  kpiDefinitions: NamedItem[];
}
interface ActivationActionView {
  id: string;
  activationCatalogItemId: string;
  activationCatalogItemArea?: string;
  activationCatalogItemName?: string;
  channelId: string | null;
  channelName?: string | null;
  objective: string | null;
  description: string | null;
  priority: string | null;
  expectedImpact: string | null;
  effort: string | null;
  responsible: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  kpiDefinitionId: string | null;
  kpiDefinitionName?: string | null;
  kpiName?: string | null;
  kpiTarget: string | null;
  kpiResult: string | null;
  isReusable: boolean | null;
  usefulLife: string | null;
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
const PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja'];
const USEFUL_LIFE_OPTIONS = ['<1 mes', '1-3 meses', '3-6 meses', '6-12 meses', '>12 meses'];

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

// Inferencia automática por extensión — sin añadir un selector nuevo al formulario.
// El primer documento de una propuesta suele ser el original recibido del solicitante.
function inferDocumentType(filename: string): 'original' | 'email' | 'image' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['eml', 'msg'].includes(ext)) return 'email';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'original';
  return 'other';
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) {
    throw new Error(`Respuesta vacía del servidor (HTTP ${res.status}). Revisa los logs de Vercel.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no válida del servidor (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

export function IntakeForm({ organizationId, defaultProvider, editing }: IntakeFormProps) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>(editing ? 'manual-extract' : 'input');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(editing?.extraction?.summary || null);
  const [submitted, setSubmitted] = useState(false);

  // Marcas de la organización — "" = Corporativo
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brandId, setBrandId] = useState(editing?.brandId ?? '');

  // Proveedor de IA elegido para ESTA propuesta (solo aplica a propuestas nuevas)
  const [providers, setProviders] = useState<AIProviderOption[] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);

  useEffect(() => {
    fetch('/api/brands')
      .then((res) => safeJson(res))
      .then((data) => setBrands(Array.isArray(data) ? data : []))
      .catch(() => setBrands([]));

    fetch('/api/ai-providers')
      .then((res) => safeJson(res))
      .then((data) => setProviders(Array.isArray(data.providers) ? data.providers : []))
      .catch(() => setProviders([{ id: 'manual', label: 'Manual (sin IA)', configured: true }]));
  }, []);

  const [proposalId, setProposalId] = useState<string | null>(editing?.proposalId ?? null);
  const [documentId, setDocumentId] = useState<string | null>(editing?.documentId ?? null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  // Formulario de extracción manual
  const [manualRequesterName, setManualRequesterName] = useState(editing?.extraction?.requesterName ?? '');
  const [manualRequesterOrg, setManualRequesterOrg] = useState(editing?.extraction?.requesterOrg ?? '');
  const [manualCollaborationType, setManualCollaborationType] = useState(editing?.extraction?.collaborationType ?? '');
  const [manualSummary, setManualSummary] = useState(editing?.extraction?.summary ?? '');
  const [manualAmount, setManualAmount] = useState(editing?.extraction?.amount ?? '');
  const [manualWebsite, setManualWebsite] = useState(editing?.extraction?.website ?? '');
  const [manualFacebook, setManualFacebook] = useState(editing?.extraction?.facebook ?? '');
  const [manualInstagram, setManualInstagram] = useState(editing?.extraction?.instagram ?? '');
  const [manualYoutube, setManualYoutube] = useState(editing?.extraction?.youtube ?? '');
  const [manualAssetsOffered, setManualAssetsOffered] = useState(editing?.extraction?.assetsOffered ?? '');
  const [manualOpportunities, setManualOpportunities] = useState(editing?.extraction?.opportunities ?? '');
  const [manualDetectedRisks, setManualDetectedRisks] = useState(editing?.extraction?.risks ?? '');
  const [manualWebEnrichment, setManualWebEnrichment] = useState('');
  const [enrichingWeb, setEnrichingWeb] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Formulario de evaluación manual: valores por id de catálogo
  const [manualScores, setManualScores] = useState<Record<string, string>>(editing?.scores ?? {});
  const [manualRisks, setManualRisks] = useState<Record<string, { level: string; impact: string }>>(editing?.risks ?? {});
  const [manualFinancials, setManualFinancials] = useState<Record<string, string>>(editing?.financials ?? {});

  // Plan de activación
  const [activationCatalog, setActivationCatalog] = useState<ActivationCatalogData | null>(null);
  const [activationActions, setActivationActions] = useState<ActivationActionView[]>([]);
  const [activationMessage, setActivationMessage] = useState<string | null>(null);

  const [newActionItemId, setNewActionItemId] = useState('');
  const [newActionChannelId, setNewActionChannelId] = useState('');
  const [newActionObjective, setNewActionObjective] = useState('');
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionPriority, setNewActionPriority] = useState('Media');
  const [newActionImpact, setNewActionImpact] = useState('Medio');
  const [newActionEffort, setNewActionEffort] = useState('Medio');
  const [newActionResponsible, setNewActionResponsible] = useState('');
  const [newActionStartDate, setNewActionStartDate] = useState('');
  const [newActionEndDate, setNewActionEndDate] = useState('');
  const [newActionKpiName, setNewActionKpiName] = useState('');
  const [newActionKpiTarget, setNewActionKpiTarget] = useState('');
  const [newActionReusable, setNewActionReusable] = useState(false);
  const [newActionUsefulLife, setNewActionUsefulLife] = useState('');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);

  useEffect(() => {
    if (result && activationCatalog === null && proposalId) {
      Promise.all([
        fetch('/api/activation-catalog').then(async (res) => {
          const data = await safeJson(res);
          if (!res.ok) throw new Error(data.error ?? 'Error al cargar el catálogo de activación.');
          return data;
        }),
        fetch(`/api/activations?proposalId=${proposalId}`).then(async (res) => {
          const data = await safeJson(res);
          if (!res.ok) throw new Error(data.error ?? 'Error al cargar las activaciones.');
          return data;
        }),
      ])
        .then(([catalogData, actionsData]) => {
          setActivationCatalog(catalogData);
          setActivationActions(Array.isArray(actionsData) ? actionsData : []);
        })
        .catch((err) => {
          setActivationCatalog({ items: [], channels: [], kpiDefinitions: [] });
          setActivationMessage(`No se pudo cargar el plan de activación: ${(err as Error).message}`);
        });
    }
  }, [result, activationCatalog, proposalId]);

  function resetActivationForm() {
    setNewActionItemId('');
    setNewActionChannelId('');
    setNewActionObjective('');
    setNewActionDescription('');
    setNewActionPriority('Media');
    setNewActionImpact('Medio');
    setNewActionEffort('Medio');
    setNewActionResponsible('');
    setNewActionStartDate('');
    setNewActionEndDate('');
    setNewActionKpiName('');
    setNewActionKpiTarget('');
    setNewActionReusable(false);
    setNewActionUsefulLife('');
    setEditingActionId(null);
  }

  function handleStartEditActivationAction(a: (typeof activationActions)[number]) {
    setEditingActionId(a.id);
    setNewActionItemId(a.activationCatalogItemId ?? '');
    setNewActionChannelId(a.channelId ?? '');
    setNewActionObjective(a.objective ?? '');
    setNewActionDescription(a.description ?? '');
    setNewActionPriority(a.priority ?? 'Media');
    setNewActionImpact(a.expectedImpact ?? 'Medio');
    setNewActionEffort(a.effort ?? 'Medio');
    setNewActionResponsible(a.responsible ?? '');
    setNewActionStartDate(a.startDate ?? '');
    setNewActionEndDate(a.endDate ?? '');
    setNewActionKpiName(a.kpiName ?? '');
    setNewActionKpiTarget(a.kpiTarget ?? '');
    setNewActionReusable(a.isReusable ?? false);
    setNewActionUsefulLife(a.usefulLife ?? '');
    setActivationMessage(null);
  }

  async function handleAddActivationAction(event: FormEvent) {
    event.preventDefault();
    if (!proposalId || !newActionItemId) return;
    setActivationMessage(null);

    const payload = {
      activationCatalogItemId: newActionItemId,
      channelId: newActionChannelId || null,
      objective: newActionObjective || null,
      description: newActionDescription || null,
      priority: newActionPriority || null,
      expectedImpact: newActionImpact || null,
      effort: newActionEffort || null,
      responsible: newActionResponsible || null,
      startDate: newActionStartDate || null,
      endDate: newActionEndDate || null,
      kpiName: newActionKpiName || null,
      kpiTarget: newActionKpiTarget || null,
      isReusable: newActionReusable,
      usefulLife: newActionUsefulLife || null,
    };

    try {
      if (editingActionId) {
        const res = await fetch(`/api/activations/${editingActionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error ?? 'Error al guardar los cambios.');

        setActivationActions((prev) =>
          prev.map((a) =>
            a.id === editingActionId
              ? {
                  ...a,
                  ...payload,
                  activationCatalogItemArea:
                    activationCatalog?.items.find((i) => i.id === newActionItemId)?.area ?? a.activationCatalogItemArea,
                  activationCatalogItemName:
                    activationCatalog?.items.find((i) => i.id === newActionItemId)?.name ?? a.activationCatalogItemName,
                  channelName: activationCatalog?.channels.find((c) => c.id === newActionChannelId)?.name ?? null,
                }
              : a,
          ),
        );
        setActivationMessage('Cambios guardados.');
      } else {
        const res = await fetch('/api/activations/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId, ...payload }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error ?? 'Error al añadir la acción.');

        setActivationActions((prev) => [...prev, data]);
        setActivationMessage('Acción añadida al plan.');
      }
      resetActivationForm();
    } catch (error) {
      setActivationMessage((error as Error).message);
    }
  }

  async function handleDeleteActivationAction(id: string) {
    setActivationActions((prev) => prev.filter((a) => a.id !== id));
    if (editingActionId === id) resetActivationForm();
    try {
      await fetch(`/api/activations/${id}`, { method: 'DELETE' });
    } catch {
      // no crítico — si falla, reaparecerá al recargar la ficha de la propuesta
    }
  }

  async function handleSubmitProposal() {
    if (!proposalId) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/submit`, { method: 'POST' });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar la propuesta.');
      setSubmitted(true);
      setMessage('Propuesta enviada. Ya no se puede editar.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

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
    if (!files.length) {
      setPhase('error');
      setMessage('Sube al menos un documento — hace falta para la extracción, automática o manual.');
      return;
    }

    try {
      setPhase('creating-proposal');
      const proposalRes = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, brandId: brandId || null }),
      });
      const proposal = await safeJson(proposalRes);
      if (!proposalRes.ok) throw new Error(proposal.error ?? 'Error al crear la propuesta.');
      setProposalId(proposal.id);

      setPhase('uploading');
      const supabase = createSupabaseBrowserClient();

      let primaryDocumentId: string | null = null;
      let primaryStoragePath: string | null = null;

      for (const currentFile of files) {
        const storagePath = `${organizationId}/${proposal.id}/${Date.now()}_${sanitizeFilename(currentFile.name)}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, currentFile);
        if (uploadError) throw uploadError;

        setPhase('registering');
        const documentRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposalId: proposal.id,
            storagePath,
            originalFilename: currentFile.name,
            documentType: inferDocumentType(currentFile.name),
          }),
        });
        const document = await safeJson(documentRes);
        if (!documentRes.ok) throw new Error(document.error ?? `Error al registrar el documento "${currentFile.name}".`);

        if (!primaryDocumentId) {
          primaryDocumentId = document.id;
          primaryStoragePath = storagePath;
        }
      }

      setDocumentId(primaryDocumentId);
      // El Agente 1 (extracción) se hace siempre a mano — en la práctica fallaba mucho
      // cuando el dossier no tenía la información muy clara o completa. La IA entra a
      // partir del Agente 2 (scoring/riesgo/activación/financials), usando estos mismos
      // datos que rellena la persona — el motor no distingue si vinieron de un humano o
      // de un agente, así que no hace falta ningún cambio en el resto del flujo.
      setPhase('manual-extract');
    } catch (error) {
      setPhase('error');
      setMessage((error as Error).message);
    }
  }

  async function handleEnrichWithWeb() {
    setEnrichingWeb(true);
    setEnrichError(null);
    try {
      const brandName = brands?.find((b) => b.id === brandId)?.name ?? null;
      const res = await fetch('/api/enrich-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName: manualRequesterName,
          website: manualWebsite,
          socialInstagram: manualInstagram,
          socialFacebook: manualFacebook,
          socialYoutube: manualYoutube,
          brandName,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Error al buscar en internet.');
      setManualWebEnrichment(data.summary);
    } catch (error) {
      setEnrichError((error as Error).message);
    } finally {
      setEnrichingWeb(false);
    }
  }

  async function handleManualExtractionSubmit(event: FormEvent) {
    event.preventDefault();
    if (!proposalId) return;

    try {
      setPhase('saving-manual-extraction');

      if (editing) {
        const patchRes = await fetch(`/api/proposals/${proposalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, brandId: brandId || null }),
        });
        const patchData = await safeJson(patchRes);
        if (!patchRes.ok) throw new Error(patchData.error ?? 'Error al actualizar la propuesta.');
      }

      const toList = (text: string) =>
        text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

      const extractedJson = {
        requester_name: manualRequesterName || null,
        requester_org: manualRequesterOrg || null,
        collaboration_type: manualCollaborationType || null,
        summary: manualSummary,
        assets_offered: toList(manualAssetsOffered),
        estimated_total_amount: manualAmount ? Number(manualAmount) : null,
        currency: 'EUR',
        opportunities: toList(manualOpportunities),
        risks: toList(manualDetectedRisks),
        website: manualWebsite || null,
        social_facebook: manualFacebook || null,
        social_instagram: manualInstagram || null,
        social_youtube: manualYoutube || null,
        web_enrichment: manualWebEnrichment || null,
      };

      const res = await fetch('/api/extractions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, documentId, extractedJson }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar la extracción manual.');

      setExtractedSummary(manualSummary || null);

      if (selectedProvider !== 'manual') {
        // Agentes 2-5 con IA, usando los datos que se acaban de rellenar a mano — el
        // motor de evaluación no distingue si extractedData vino de un agente o de aquí.
        setPhase('evaluating');
        const evaluationRes = await fetch('/api/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId, provider: selectedProvider }),
        });
        const evaluation = await safeJson(evaluationRes);
        if (!evaluationRes.ok) throw new Error(evaluation.error ?? 'Error en la evaluación.');

        setResult(evaluation);
        setPhase('done');
        setMessage(`Extracción manual guardada. Evaluada con ${selectedProvider}. Sigue en Borrador hasta que la envíes.`);
        return;
      }

      const catalogRes = await fetch('/api/catalog');
      const catalogData = await safeJson(catalogRes);
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
      const evaluation = await safeJson(res);
      if (!res.ok) throw new Error(evaluation.error ?? 'Error al evaluar manualmente.');

      setResult(evaluation);
      setPhase('done');
      setMessage('Propuesta evaluada manualmente (source="manual"). Sigue en Borrador hasta que la envíes.');
    } catch (error) {
      setPhase('error');
      setMessage((error as Error).message);
    }
  }

  const configuredProviders = (providers ?? []).filter((p) => p.configured);

  return (
    <div>
      {phase === 'input' || (loading && !editing) ? (
        <form onSubmit={handleInitialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Título de la propuesta</label>
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Organización / Marca</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={loading} style={{ width: '100%', padding: 8 }}>
              <option value="">Corporativo (Gor Factory)</option>
              {(brands ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Método de evaluación</label>
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} disabled={loading} style={{ width: '100%', padding: 8 }}>
              {configuredProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              La extracción de datos del documento (Agente 1) siempre la haces tú, a mano — es donde más falla la IA
              cuando el dossier no es muy claro.{' '}
              {selectedProvider === 'manual'
                ? 'También introducirás tú el scoring, el riesgo y los financials.'
                : `El scoring, el riesgo, la activación y los financials los calculará ${configuredProviders.find((p) => p.id === selectedProvider)?.label ?? selectedProvider} a partir de esos datos.`}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Documentos (PDF/imagen) — puedes seleccionar varios (dossier, presentación, tarifa...). Sirven como
              referencia y quedan adjuntos a la propuesta; los datos para evaluar los introduces tú en el siguiente paso.
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!loading) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (loading) return;
                const dropped = Array.from(e.dataTransfer.files ?? []).filter((f) =>
                  ['application/pdf', 'image/png', 'image/jpeg'].includes(f.type),
                );
                if (!dropped.length) return;
                setFiles((prev) => {
                  const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
                  const newOnes = dropped.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
                  return [...prev, ...newOnes];
                });
              }}
              style={{
                border: `2px dashed ${isDragging ? 'var(--c-amber)' : 'var(--c-line)'}`,
                borderRadius: 'var(--radius)',
                background: isDragging ? 'var(--c-amber-l)' : 'var(--c-light)',
                padding: '20px',
                textAlign: 'center',
                transition: 'border-color .15s, background .15s',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--c-mid)' }}>
                Arrastra aquí el dossier, la presentación o la tarifa — o
              </p>
              <label
                htmlFor="intake-file-input"
                className="btn btn-outline"
                style={{ display: 'inline-block', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}
              >
                Examinar archivos
              </label>
              <input
                id="intake-file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);
                  if (!selected.length) return;
                  setFiles((prev) => {
                    const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
                    const newOnes = selected.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
                    return [...prev, ...newOnes];
                  });
                  e.target.value = ''; // permite volver a elegir el mismo archivo si se quita y se vuelve a añadir
                }}
                disabled={loading}
                style={{ display: 'none' }}
              />
            </div>

            {files.length > 0 && (
              <ul style={{ fontSize: 12, color: 'var(--c-mid)', margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
                {files.map((f, i) => (
                  <li key={`${f.name}_${f.size}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <span>
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={loading}
                      style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn btn-amber" style={{ width: 'fit-content' }}>
            {loading ? PHASE_LABEL[phase] : 'Crear propuesta (Borrador) →'}
          </button>
        </form>
      ) : null}

      {phase === 'manual-extract' && (
        <form onSubmit={handleManualExtractionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
          <h2 style={{ fontSize: 15 }}>Extracción manual (equivalente al Agente 1)</h2>

          {editing && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Título de la propuesta</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Organización / Marca</label>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} style={{ width: '100%', padding: 6 }}>
                  <option value="">Corporativo (Gor Factory)</option>
                  {(brands ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

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
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Activos ofrecidos <span style={{ fontWeight: 400, color: '#888' }}>(uno por línea)</span>
            </label>
            <textarea
              value={manualAssetsOffered}
              onChange={(e) => setManualAssetsOffered(e.target.value)}
              rows={4}
              placeholder={'ej:\nEmbajador de marca (9.000€/12 meses)\n12 reels al año en redes sociales\n1 meet & greet con firma de autógrafos\nSesión fotográfica y cesión de derechos de imagen'}
              style={{ width: '100%', padding: 6 }}
            />
            <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
              Esto es lo que más usa la IA para puntuar (afinidad, potencial comercial, alcance...) — cuanto más
              concreto, mejor la evaluación. Sin esto, casi todos los atributos saldrán en 0 por falta de evidencia.
            </p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Oportunidades detectadas <span style={{ fontWeight: 400, color: '#888' }}>(uno por línea, opcional)</span>
            </label>
            <textarea
              value={manualOpportunities}
              onChange={(e) => setManualOpportunities(e.target.value)}
              rows={2}
              placeholder={'ej:\nRoyalty escalable sobre ventas de la línea de ropa cápsula\nCódigo de descuento propio para medir ventas atribuidas'}
              style={{ width: '100%', padding: 6 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Riesgos detectados en el documento <span style={{ fontWeight: 400, color: '#888' }}>(uno por línea, opcional)</span>
            </label>
            <textarea
              value={manualDetectedRisks}
              onChange={(e) => setManualDetectedRisks(e.target.value)}
              rows={2}
              placeholder={'ej:\nSin exclusividad — puede vestir otras marcas de su club\nSin mecanismo de reporting de resultados definido'}
              style={{ width: '100%', padding: 6 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Web del solicitante</label>
            <input type="text" value={manualWebsite} onChange={(e) => setManualWebsite(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: 6 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Facebook</label>
              <input type="text" value={manualFacebook} onChange={(e) => setManualFacebook(e.target.value)} placeholder="https://facebook.com/..." style={{ width: '100%', padding: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Instagram</label>
              <input type="text" value={manualInstagram} onChange={(e) => setManualInstagram(e.target.value)} placeholder="https://instagram.com/..." style={{ width: '100%', padding: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>YouTube</label>
              <input type="text" value={manualYoutube} onChange={(e) => setManualYoutube(e.target.value)} placeholder="https://youtube.com/..." style={{ width: '100%', padding: 6 }} />
            </div>
          </div>

          <div style={{ border: '1px solid var(--c-line)', borderRadius: 'var(--radius)', padding: 12, background: 'var(--c-light)' }}>
            <button
              type="button"
              onClick={handleEnrichWithWeb}
              disabled={enrichingWeb || !configuredProviders.some((p) => p.id === 'openai')}
              className="btn btn-outline"
              style={{ fontSize: 13 }}
            >
              {enrichingWeb ? 'Buscando en internet...' : '🔍 Enriquecer con búsqueda web (OpenAI)'}
            </button>
            <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0' }}>
              Busca información pública sobre el solicitante (nombre, web, redes) y la cruza con la marca elegida
              arriba. Tiene coste y tarda unos segundos — úsalo cuando de verdad haya algo que buscar (una persona,
              un club, un embajador), no en un simple evento sin figura pública detrás.
              {!configuredProviders.some((p) => p.id === 'openai') && ' (Necesita OPENAI_API_KEY configurada.)'}
            </p>
            {enrichError && <p style={{ fontSize: 12, color: 'crimson', margin: '6px 0 0' }}>{enrichError}</p>}
            {manualWebEnrichment && (
              <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Encontrado en la web <span style={{ fontWeight: 400, color: '#888' }}>(revisa y edita antes de guardar)</span>
                </label>
                <textarea
                  value={manualWebEnrichment}
                  onChange={(e) => setManualWebEnrichment(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: 6 }}
                />
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn btn-amber" style={{ width: 'fit-content' }}>
            {loading ? PHASE_LABEL[phase] : 'Guardar extracción y continuar →'}
          </button>
        </form>
      )}

      {phase === 'manual-evaluate' && catalog && (
        <form onSubmit={handleManualEvaluationSubmit} style={{ marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Evaluación manual (equivalente a los Agentes 2/3/4/5)</h2>

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
                onChange={(e) => setManualRisks((prev) => ({ ...prev, [f.id]: { ...prev[f.id], level: e.target.value, impact: prev[f.id]?.impact ?? 'Bajo' } }))}
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
                onChange={(e) => setManualRisks((prev) => ({ ...prev, [f.id]: { level: prev[f.id]?.level ?? 'Bajo', impact: e.target.value } }))}
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

          <h3 style={{ fontSize: 13, marginTop: 16 }}>Costes-ROI (por bloque económico)</h3>
          {Object.entries(
            catalog.economicConcepts.reduce<Record<string, CatalogConcept[]>>((acc, c) => {
              const key = c.blockType ?? 'Otros';
              (acc[key] ??= []).push(c);
              return acc;
            }, {}),
          ).map(([blockType, concepts]) => (
            <div key={blockType} style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: 12 }}>{blockType}</strong>
              {concepts.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <label style={{ fontSize: 12, flex: 1 }}>
                    {c.name} ({c.nature === 'cost' ? 'coste' : c.nature === 'resource' ? 'recurso' : 'resultado'})
                  </label>
                  <input
                    type="number"
                    value={manualFinancials[c.id] ?? ''}
                    onChange={(e) => setManualFinancials((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    style={{ width: 120, padding: 4 }}
                  />
                </div>
              ))}
            </div>
          ))}

          <button type="submit" disabled={loading} className="btn btn-amber" style={{ marginTop: 16 }}>
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
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Scoring por atributo ({result.scores.length})</summary>
            <ul style={{ fontSize: 12, marginTop: 8 }}>
              {result.scores.map((s) => (
                <li key={s.attributeId} style={{ marginBottom: 4 }}>
                  {s.scoreValue.toFixed(3)} — {s.rationale}
                </li>
              ))}
            </ul>
          </details>

          <details style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Factores de riesgo ({result.risks.length})</summary>
            <ul style={{ fontSize: 12, marginTop: 8 }}>
              {result.risks.map((r) => (
                <li key={r.factorId} style={{ marginBottom: 4 }}>
                  Nivel {r.level} / Impacto {r.impact} → puntuación {r.computedScore}
                </li>
              ))}
            </ul>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Líneas financieras ({result.financials.length})</summary>
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

      {result && (
        <div style={{ marginTop: 20, border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Plan de activación</h2>
          <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 12 }}>
            Cada acción es independiente — puedes añadir la misma acción del catálogo varias veces (ej. dos
            publicaciones de Instagram distintas), cada una con su propio objetivo, responsable y KPI.
          </p>

          {activationCatalog === null ? (
            <p style={{ fontSize: 13, color: '#888' }}>Cargando catálogo...</p>
          ) : (
            <>
              {activationActions.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: 6 }}>Acción</th>
                        <th style={{ padding: 6 }}>Canal</th>
                        <th style={{ padding: 6 }}>Prioridad</th>
                        <th style={{ padding: 6 }}>Responsable</th>
                        <th style={{ padding: 6 }}>KPI objetivo</th>
                        <th style={{ padding: 6 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activationActions.map((a) => (
                        <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 6 }}>
                            {a.activationCatalogItemArea} — {a.activationCatalogItemName}
                          </td>
                          <td style={{ padding: 6 }}>{a.channelName ?? '—'}</td>
                          <td style={{ padding: 6 }}>{a.priority ?? '—'}</td>
                          <td style={{ padding: 6 }}>{a.responsible ?? '—'}</td>
                          <td style={{ padding: 6 }}>
                            {a.kpiName || a.kpiDefinitionName ? `${a.kpiName ?? a.kpiDefinitionName}: ${a.kpiTarget ?? '—'}` : '—'}
                          </td>
                          <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditActivationAction(a)}
                              style={{ fontSize: 11, color: 'var(--c-amber)', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}
                            >
                              Editar
                            </button>
                            <button type="button" onClick={() => handleDeleteActivationAction(a.id)} style={{ fontSize: 11, color: 'crimson', background: 'none', border: 'none', cursor: 'pointer' }}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <form onSubmit={handleAddActivationAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <strong style={{ fontSize: 13 }}>{editingActionId ? 'Editar acción' : 'Añadir acción'}</strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Acción del catálogo</label>
                    <select value={newActionItemId} onChange={(e) => setNewActionItemId(e.target.value)} required style={{ width: '100%', padding: 5 }}>
                      <option value="">— selecciona —</option>
                      {Object.entries(
                        activationCatalog.items.reduce<Record<string, ActivationCatalogItem[]>>((acc, item) => {
                          (acc[item.area] ??= []).push(item);
                          return acc;
                        }, {}),
                      ).map(([area, items]) => (
                        <optgroup key={area} label={area}>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Canal</label>
                    <select value={newActionChannelId} onChange={(e) => setNewActionChannelId(e.target.value)} style={{ width: '100%', padding: 5 }}>
                      <option value="">—</option>
                      {activationCatalog.channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Objetivo</label>
                  <input type="text" value={newActionObjective} onChange={(e) => setNewActionObjective(e.target.value)} placeholder="ej: Generar notoriedad de marca en el evento" style={{ width: '100%', padding: 5 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Descripción</label>
                  <textarea value={newActionDescription} onChange={(e) => setNewActionDescription(e.target.value)} rows={2} style={{ width: '100%', padding: 5 }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Prioridad</label>
                    <select value={newActionPriority} onChange={(e) => setNewActionPriority(e.target.value)} style={{ width: '100%', padding: 5 }}>
                      {PRIORITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Impacto esperado</label>
                    <select value={newActionImpact} onChange={(e) => setNewActionImpact(e.target.value)} style={{ width: '100%', padding: 5 }}>
                      {RISK_OPTIONS.slice().reverse().map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Esfuerzo</label>
                    <select value={newActionEffort} onChange={(e) => setNewActionEffort(e.target.value)} style={{ width: '100%', padding: 5 }}>
                      {RISK_OPTIONS.slice().reverse().map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Responsable</label>
                    <input type="text" value={newActionResponsible} onChange={(e) => setNewActionResponsible(e.target.value)} style={{ width: '100%', padding: 5 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Fecha inicio</label>
                    <input type="date" value={newActionStartDate} onChange={(e) => setNewActionStartDate(e.target.value)} style={{ width: '100%', padding: 5 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Fecha fin</label>
                    <input type="date" value={newActionEndDate} onChange={(e) => setNewActionEndDate(e.target.value)} style={{ width: '100%', padding: 5 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>KPI principal</label>
                    <input
                      type="text"
                      value={newActionKpiName}
                      onChange={(e) => setNewActionKpiName(e.target.value)}
                      placeholder="ej: Alcance, Interacciones, Leads..."
                      style={{ width: '100%', padding: 5 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Objetivo del KPI</label>
                    <input type="text" value={newActionKpiTarget} onChange={(e) => setNewActionKpiTarget(e.target.value)} placeholder="ej: 5.000 interacciones" style={{ width: '100%', padding: 5 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={newActionReusable} onChange={(e) => setNewActionReusable(e.target.checked)} />
                    Contenido reutilizable
                  </label>
                  <div style={{ flex: 1 }}>
                    <select value={newActionUsefulLife} onChange={(e) => setNewActionUsefulLife(e.target.value)} style={{ width: '100%', padding: 5 }}>
                      <option value="">Vida útil del contenido —</option>
                      {USEFUL_LIFE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button type="submit" className="btn btn-amber" style={{ width: 'fit-content' }}>
                    {editingActionId ? 'Guardar cambios' : '+ Añadir acción'}
                  </button>
                  {editingActionId && (
                    <button type="button" onClick={resetActivationForm} className="btn btn-outline" style={{ width: 'fit-content', fontSize: 13 }}>
                      Cancelar edición
                    </button>
                  )}
                </div>
                {activationMessage && <p style={{ fontSize: 12, color: 'green', margin: 0 }}>{activationMessage}</p>}
              </form>
            </>
          )}
        </div>
      )}

      {result && !submitted && (
        <div style={{ marginTop: 20, padding: 16, background: '#FAEEDA', borderRadius: 4 }}>
          <p style={{ fontSize: 13, margin: '0 0 10px' }}>
            La propuesta sigue en <strong>Borrador</strong>: puedes volver más tarde desde su ficha y editar
            cualquier paso. Cuando esté lista de verdad, envíala — a partir de ahí queda bloqueada.
          </p>
          <button type="button" className="btn btn-amber" onClick={handleSubmitProposal}>
            ✅ Enviar propuesta (deja de ser Borrador)
          </button>
        </div>
      )}

      {submitted && proposalId && (
        <p style={{ marginTop: 16 }}>
          <Link href={`/proposals/${proposalId}`}>Ver la ficha de la propuesta →</Link>
        </p>
      )}
    </div>
  );
}
