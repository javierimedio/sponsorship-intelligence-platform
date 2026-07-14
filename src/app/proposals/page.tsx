// src/app/proposals/page.tsx
// Pipeline de decisiones (Fase 3) — Server Component: resuelve TODOS los datos (incluido
// el responsable, vía la relación ya existente proposals.created_by → profiles) y se los
// entrega a PipelineView, que hace filtrado/orden/búsqueda en el cliente.

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PipelineView, type PipelineProposal } from './pipeline-view';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { getWorkspaceStage } from '@/lib/workspace-stage';

interface PageProps {
  searchParams: { estado?: string };
}

export default async function ProposalsPage({ searchParams }: PageProps) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return (
      <AppShell>
        <p>No has iniciado sesión o tu usuario no tiene perfil de negocio asignado.</p>
      </AppShell>
    );
  }

  const { data: proposals, error } = await supabase
    .from('proposals')
    .select(
      'id, title, total_score, overall_risk_level, recommendation, created_at, updated_at, ' +
        'submitted_at, approved_at, rejected_at, finalized_at, archived_at, partner_name, ' +
        'brands(name), profiles(full_name)',
    )
    .order('created_at', { ascending: false });

  const pipelineData: PipelineProposal[] = (proposals ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    brandName: p.brands?.name ?? 'Corporativo',
    partnerName: p.partner_name,
    responsibleName: p.profiles?.full_name ?? null,
    totalScore: p.total_score,
    overallRiskLevel: p.overall_risk_level,
    recommendation: p.recommendation,
    stage: getWorkspaceStage(p),
    createdAt: p.created_at,
    updatedAt: p.updated_at ?? p.created_at,
  }));

  const initialStageFilter = searchParams.estado === 'pendiente' ? 'pending' : undefined;
  const isViewer = profile.appRole === 'viewer';

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Propuestas</h1>
        {!isViewer && (
          <Link href="/intake" className="btn btn-amber">
            + Nueva propuesta
          </Link>
        )}
      </div>

      {error ? (
        <p style={{ color: 'crimson' }}>{error.message}</p>
      ) : (
        <PipelineView proposals={pipelineData} initialStageFilter={initialStageFilter} isViewer={isViewer} />
      )}
    </AppShell>
  );
}
