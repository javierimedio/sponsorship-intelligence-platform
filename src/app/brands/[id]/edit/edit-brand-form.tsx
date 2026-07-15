// src/app/brands/[id]/edit/edit-brand-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormData {
  name: string;
  website: string;
  socialInstagram: string;
  socialFacebook: string;
  socialYoutube: string;
  businessModel: string;
  targetAudience: string;
  description: string;
  positioning: string;
  toneOfVoice: string;
  recommendedActivations: string;
  negotiationGuidelines: string;
  evaluationBias: string;
  decisionStyle: string;
  marketingObjectives: string;
  evaluationFocus: string;
  idealCollaborations: string;
  avoidCollaborations: string;
  strategicPriorities: string;
  brandValues: string;
  successExamples: string;
  redFlags: string;
  preferredKpis: string;
}

const ARRAY_FIELDS: (keyof FormData)[] = [
  'marketingObjectives', 'evaluationFocus', 'idealCollaborations', 'avoidCollaborations',
  'strategicPriorities', 'brandValues', 'successExamples', 'redFlags', 'preferredKpis',
];

function Field({ label, value, onChange, rows = 2, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={{ width: '100%', padding: 8 }} />
      {hint && <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
}

export function EditBrandForm({ brandId, initial }: { brandId: string; initial: FormData }) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormData>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCompleteWithAI() {
    setCompleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/complete-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: form.name,
          website: form.website,
          socialInstagram: form.socialInstagram,
          socialFacebook: form.socialFacebook,
          socialYoutube: form.socialYoutube,
          businessModel: form.businessModel,
          targetAudience: form.targetAudience,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al completar el perfil.');

      setForm((prev) => ({
        ...prev,
        description: data.description ?? prev.description,
        positioning: data.positioning ?? prev.positioning,
        toneOfVoice: data.toneOfVoice ?? prev.toneOfVoice,
        recommendedActivations: data.recommendedActivations ?? prev.recommendedActivations,
        negotiationGuidelines: data.negotiationGuidelines ?? prev.negotiationGuidelines,
        evaluationBias: data.evaluationBias ?? prev.evaluationBias,
        decisionStyle: data.decisionStyle ?? prev.decisionStyle,
        marketingObjectives: (data.marketingObjectives ?? []).join('\n') || prev.marketingObjectives,
        evaluationFocus: (data.evaluationFocus ?? []).join('\n') || prev.evaluationFocus,
        idealCollaborations: (data.idealCollaborations ?? []).join('\n') || prev.idealCollaborations,
        avoidCollaborations: (data.avoidCollaborations ?? []).join('\n') || prev.avoidCollaborations,
        strategicPriorities: (data.strategicPriorities ?? []).join('\n') || prev.strategicPriorities,
        brandValues: (data.brandValues ?? []).join('\n') || prev.brandValues,
        successExamples: (data.successExamples ?? []).join('\n') || prev.successExamples,
        redFlags: (data.redFlags ?? []).join('\n') || prev.redFlags,
        preferredKpis: (data.preferredKpis ?? []).join('\n') || prev.preferredKpis,
      }));
      setMessage('Perfil completado — revisa todos los campos antes de guardar, nada se ha guardado todavía.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const toList = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);
      const payload: Record<string, unknown> = { ...form };
      for (const field of ARRAY_FIELDS) payload[field] = toList(form[field]);

      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar.');
      setMessage('Guardado.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-title">Identidad básica</div>
        <Field label="Nombre" value={form.name} onChange={(v) => set('name', v)} rows={1} />
        <Field label="Web" value={form.website} onChange={(v) => set('website', v)} rows={1} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Field label="Instagram" value={form.socialInstagram} onChange={(v) => set('socialInstagram', v)} rows={1} />
          <Field label="Facebook" value={form.socialFacebook} onChange={(v) => set('socialFacebook', v)} rows={1} />
          <Field label="YouTube" value={form.socialYoutube} onChange={(v) => set('socialYoutube', v)} rows={1} />
        </div>
        <Field label="Perfil comercial" value={form.businessModel} onChange={(v) => set('businessModel', v)} />
        <Field label="Cliente potencial" value={form.targetAudience} onChange={(v) => set('targetAudience', v)} />
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>ADN de marca (IA)</span>
          <button onClick={handleCompleteWithAI} disabled={completing || !form.name.trim()} className="btn btn-amber" style={{ fontSize: 12 }}>
            {completing ? 'Buscando y completando...' : '✨ Completar perfil con IA (OpenAI)'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--c-mid)', marginTop: 0 }}>
          Investiga a partir de la identidad básica de arriba y rellena los campos vacíos — revisa y edita antes de
          guardar, nada se persiste solo con este botón.
        </p>

        <Field label="Descripción" value={form.description} onChange={(v) => set('description', v)} rows={3} />
        <Field label="Posicionamiento" value={form.positioning} onChange={(v) => set('positioning', v)} />
        <Field label="Tono de voz" value={form.toneOfVoice} onChange={(v) => set('toneOfVoice', v)} rows={1} />
        <Field
          label="Objetivos de marketing"
          value={form.marketingObjectives}
          onChange={(v) => set('marketingObjectives', v)}
          rows={3}
          hint="Uno por línea"
        />
        <Field
          label="Foco de evaluación"
          value={form.evaluationFocus}
          onChange={(v) => set('evaluationFocus', v)}
          rows={3}
          hint="Uno por línea — lo que esta marca prioriza al valorar una propuesta"
        />
        <Field
          label="Colaboraciones ideales"
          value={form.idealCollaborations}
          onChange={(v) => set('idealCollaborations', v)}
          rows={3}
          hint="Uno por línea"
        />
        <Field
          label="Colaboraciones a evitar"
          value={form.avoidCollaborations}
          onChange={(v) => set('avoidCollaborations', v)}
          rows={3}
          hint="Uno por línea"
        />
        <Field
          label="Prioridades estratégicas"
          value={form.strategicPriorities}
          onChange={(v) => set('strategicPriorities', v)}
          rows={2}
          hint="Uno por línea — se usan para cerrar el Executive Summary con una recomendación"
        />
        <Field label="Valores de marca" value={form.brandValues} onChange={(v) => set('brandValues', v)} rows={2} hint="Uno por línea" />
        <Field
          label="Ejemplos de éxito"
          value={form.successExamples}
          onChange={(v) => set('successExamples', v)}
          rows={2}
          hint="Uno por línea"
        />
        <Field
          label="Señales de alerta (red flags)"
          value={form.redFlags}
          onChange={(v) => set('redFlags', v)}
          rows={2}
          hint="Uno por línea — se comparan contra los riesgos detectados en cada propuesta"
        />
        <Field label="Activaciones recomendadas" value={form.recommendedActivations} onChange={(v) => set('recommendedActivations', v)} rows={2} />
        <Field label="Pautas de negociación" value={form.negotiationGuidelines} onChange={(v) => set('negotiationGuidelines', v)} rows={2} />
        <Field label="Sesgo de evaluación" value={form.evaluationBias} onChange={(v) => set('evaluationBias', v)} rows={2} />
        <Field label="Estilo de decisión" value={form.decisionStyle} onChange={(v) => set('decisionStyle', v)} rows={2} />
        <Field label="KPIs preferidos" value={form.preferredKpis} onChange={(v) => set('preferredKpis', v)} rows={2} hint="Uno por línea" />
      </div>

      {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}
      {message && <p style={{ color: 'var(--c-green)', fontSize: 13 }}>{message}</p>}

      <button onClick={handleSave} disabled={saving} className="btn btn-amber" style={{ width: 'fit-content' }}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}
