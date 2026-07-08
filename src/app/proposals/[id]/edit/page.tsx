// src/app/proposals/[id]/edit/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { IntakeForm, type EditingData } from '@/app/intake/intake-form';

interface PageProps {
  params: { id: string };
}

export default async function EditProposalPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  const manualMode = (process.env.AI_PROVIDER ?? '').toLowerCase() === 'manual';

  if (!profile) {
    return (
      <AppShell>
        <p>No has iniciado sesión o tu usuario no tiene perfil de negocio asignado.</p>
      </AppShell>
    );
  }

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, brand_id, submitted_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!proposal) {
    return (
      <AppShell>
        <p>Propuesta no encontrada (o no tienes acceso desde tu organización).</p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </AppShell>
    );
  }

  if (proposal.submitted_at) {
    return (
      <AppShell>
        <p>
          Esta propuesta ya fue <strong>enviada</strong> el {new Date(proposal.submitted_at).toLocaleDateString('es-ES')} y
          ya no se puede editar.
        </p>
        <Link href={`/proposals/${proposal.id}`}>← Ver la ficha de la propuesta</Link>
      </AppShell>
    );
  }

  const [{ data: latestDocument }, { data: extraction }, { data: scores }, { data: risks }, { data: financials }, { data: activations }] =
    await Promise.all([
      supabase
        .from('documents')
        .select('id')
        .eq('proposal_id', params.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ai_extractions')
        .select('extracted_json')
        .eq('proposal_id', params.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('proposal_scores').select('scoring_attribute_id, score_value').eq('proposal_id', params.id),
      supabase.from('proposal_risks').select('risk_factor_id, level, impact').eq('proposal_id', params.id),
      supabase
        .from('proposal_financials')
        .select('economic_concept_id, estimated_amount')
        .eq('proposal_id', params.id),
      supabase
        .from('proposal_activations')
        .select('activation_catalog_item_id, notes')
        .eq('proposal_id', params.id),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractedJson = (extraction?.extracted_json ?? null) as Record<string, any> | null;

  const editingData: EditingData = {
    proposalId: proposal.id,
    documentId: latestDocument?.id ?? null,
    title: proposal.title,
    brandId: proposal.brand_id,
    extraction: extractedJson
      ? {
          requesterName: extractedJson.requester_name ?? '',
          requesterOrg: extractedJson.requester_org ?? '',
          collaborationType: extractedJson.collaboration_type ?? '',
          summary: extractedJson.summary ?? '',
          amount: extractedJson.estimated_total_amount != null ? String(extractedJson.estimated_total_amount) : '',
          website: extractedJson.website ?? '',
          facebook: extractedJson.social_facebook ?? '',
          instagram: extractedJson.social_instagram ?? '',
          youtube: extractedJson.social_youtube ?? '',
        }
      : null,
    scores: Object.fromEntries(
      (scores ?? []).map((s) => [s.scoring_attribute_id, String(s.score_value)]),
    ),
    risks: Object.fromEntries(
      (risks ?? []).map((r) => [r.risk_factor_id, { level: r.level, impact: r.impact }]),
    ),
    financials: Object.fromEntries(
      (financials ?? []).map((f) => [f.economic_concept_id, f.estimated_amount != null ? String(f.estimated_amount) : '']),
    ),
    activationIds: (activations ?? []).map((a) => a.activation_catalog_item_id),
    activationNotes: activations?.[0]?.notes ?? '',
  };

  return (
    <AppShell>
      <p>
        <Link href={`/proposals/${proposal.id}`}>← Volver a la ficha</Link>
      </p>
      <h1>Editar propuesta (Borrador)</h1>
      <p style={{ color: 'var(--c-mid)' }}>
        Puedes corregir cualquier paso — extracción, evaluación o plan de activación. Cada vez que guardes un
        paso se recalcula desde cero (no se acumulan versiones antiguas). Cuando esté lista, pulsa{' '}
        <strong>Enviar propuesta</strong> al final.
      </p>
      <div className="card">
        <IntakeForm organizationId={profile.organizationId} manualMode={manualMode} editing={editingData} />
      </div>
    </AppShell>
  );
}
