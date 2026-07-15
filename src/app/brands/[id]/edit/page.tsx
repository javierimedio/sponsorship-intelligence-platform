// src/app/brands/[id]/edit/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { EditBrandForm } from './edit-brand-form';

interface PageProps {
  params: { id: string };
}

export default async function EditBrandPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, website, social_instagram, social_facebook, social_youtube, brand_ai_context(*)')
    .eq('id', params.id)
    .maybeSingle();

  if (!brand) {
    return (
      <AppShell>
        <p>Marca no encontrada.</p>
        <Link href="/brands">← Volver a marcas</Link>
      </AppShell>
    );
  }

  const context = (brand as any).brand_ai_context ?? {};

  return (
    <AppShell>
      <p>
        <Link href={`/brands/${brand.id}`}>← Volver a la ficha de {brand.name}</Link>
      </p>
      <h1>Editar {brand.name}</h1>

      <EditBrandForm
        brandId={brand.id}
        initial={{
          name: brand.name,
          website: brand.website ?? '',
          socialInstagram: brand.social_instagram ?? '',
          socialFacebook: brand.social_facebook ?? '',
          socialYoutube: brand.social_youtube ?? '',
          businessModel: context.business_model ?? '',
          targetAudience: context.target_audience ?? '',
          description: context.description ?? '',
          positioning: context.positioning ?? '',
          toneOfVoice: context.tone_of_voice ?? '',
          recommendedActivations: context.recommended_activations ?? '',
          negotiationGuidelines: context.negotiation_guidelines ?? '',
          evaluationBias: context.evaluation_bias ?? '',
          decisionStyle: context.decision_style ?? '',
          marketingObjectives: (context.marketing_objectives ?? []).join('\n'),
          evaluationFocus: (context.evaluation_focus ?? []).join('\n'),
          idealCollaborations: (context.ideal_collaborations ?? []).join('\n'),
          avoidCollaborations: (context.avoid_collaborations ?? []).join('\n'),
          strategicPriorities: (context.strategic_priorities ?? []).join('\n'),
          brandValues: (context.brand_values ?? []).join('\n'),
          successExamples: (context.success_examples ?? []).join('\n'),
          redFlags: (context.red_flags ?? []).join('\n'),
          preferredKpis: (context.preferred_kpis ?? []).join('\n'),
        }}
      />
    </AppShell>
  );
}
