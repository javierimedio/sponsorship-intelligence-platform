// src/app/brands/[id]/page.tsx
// "Recomendación estratégica de marca" — dos capas deterministas (ADN de marca + histórico
// real de propuestas evaluadas, ambas gratis y siempre fiables) y una capa de IA opcional,
// con botón explícito, que combina ambas y puede buscar en internet (solo OpenAI por ahora).

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { BrandRecommendationButton } from './brand-recommendation-button';

interface PageProps {
  params: { id: string };
}

export default async function BrandDetailPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, organization_id, brand_ai_context(*)')
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

  const context = (brand as any).brand_ai_context as Record<string, any> | null;

  const { data: brandProposals } = await supabase.from('proposals').select('id, total_score').eq('brand_id', params.id);
  const proposalIds = (brandProposals ?? []).map((p) => p.id);

  const { data: extractions } = proposalIds.length
    ? await supabase
        .from('ai_extractions')
        .select('proposal_id, extracted_json, created_at')
        .in('proposal_id', proposalIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const proposals = (brandProposals ?? []).filter((p) => p.total_score !== null);

  // La extracción más reciente por propuesta — puede haber varias si se reevaluó.
  const latestExtractionByProposal = new Map<string, string>();
  for (const ex of extractions ?? []) {
    if (!latestExtractionByProposal.has(ex.proposal_id)) {
      const type = (ex.extracted_json as any)?.collaboration_type;
      latestExtractionByProposal.set(ex.proposal_id, typeof type === 'string' && type.trim() ? type.trim() : 'Sin especificar');
    }
  }

  const byType = new Map<string, { count: number; totalScore: number }>();
  for (const p of proposals ?? []) {
    const type = latestExtractionByProposal.get(p.id) ?? 'Sin especificar';
    const entry = byType.get(type) ?? { count: 0, totalScore: 0 };
    entry.count += 1;
    entry.totalScore += Number(p.total_score ?? 0);
    byType.set(type, entry);
  }
  const historicalBreakdown = [...byType.entries()].map(([collaborationType, v]) => ({
    collaborationType,
    count: v.count,
    avgScore: v.totalScore / v.count,
  }));
  const sampleSize = proposals?.length ?? 0;

  return (
    <AppShell>
      <p>
        <Link href="/brands">← Volver a marcas</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{brand.name}</h1>
        <Link href={`/brands/${brand.id}/edit`} className="btn btn-outline">
          ✏️ Editar
        </Link>
      </div>

      {!context ? (
        <div className="card">
          <p style={{ color: 'var(--c-mid)' }}>Esta marca no tiene contexto de IA configurado todavía (brand_ai_context).</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">ADN de marca</div>
          {context.positioning && <p><strong>Posicionamiento:</strong> {context.positioning}</p>}
          {context.ideal_collaborations?.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}><strong>Colaboraciones ideales</strong></p>
              <ul style={{ marginTop: 0 }}>{context.ideal_collaborations.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
            </>
          )}
          {context.avoid_collaborations?.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}><strong>Colaboraciones a evitar</strong></p>
              <ul style={{ marginTop: 0 }}>{context.avoid_collaborations.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
            </>
          )}
          {context.strategic_priorities?.length > 0 && (
            <p><strong>Prioridades estratégicas:</strong> {context.strategic_priorities.join(', ')}</p>
          )}
          {context.decision_style && <p><strong>Estilo de decisión:</strong> {context.decision_style}</p>}
        </div>
      )}

      <div className="card">
        <div className="card-title">Histórico real por tipo de colaboración</div>
        <p style={{ fontSize: 11, color: 'var(--c-mid)', marginTop: 0 }}>
          Basado en {sampleSize} propuesta(s) evaluada(s) de esta marca — matemática pura sobre lo que ya hay
          evaluado, sin IA. {sampleSize < 5 && 'Muestra todavía pequeña — poco significativa estadísticamente.'}
        </p>
        {!historicalBreakdown.length ? (
          <p style={{ color: 'var(--c-mid)' }}>Sin propuestas evaluadas todavía para esta marca.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo de colaboración</th>
                <th>Nº propuestas</th>
                <th>Score medio</th>
              </tr>
            </thead>
            <tbody>
              {historicalBreakdown
                .sort((a, b) => b.avgScore - a.avgScore)
                .map((h) => (
                  <tr key={h.collaborationType}>
                    <td>{h.collaborationType}</td>
                    <td>{h.count}</td>
                    <td>{Math.round(h.avgScore * 100)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {context && (
        <BrandRecommendationButton
          brandName={brand.name}
          positioning={context.positioning ?? null}
          idealCollaborations={context.ideal_collaborations ?? null}
          avoidCollaborations={context.avoid_collaborations ?? null}
          strategicPriorities={context.strategic_priorities ?? null}
          evaluationBias={context.evaluation_bias ?? null}
          decisionStyle={context.decision_style ?? null}
          historicalBreakdown={historicalBreakdown}
        />
      )}
    </AppShell>
  );
}
