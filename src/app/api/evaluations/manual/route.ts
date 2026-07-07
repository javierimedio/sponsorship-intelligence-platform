// src/app/api/evaluations/manual/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import {
  SupabaseEvaluationCatalogRepository,
  SupabaseEvaluationResultRepository,
} from '@/infrastructure/supabase/evaluation-repository';
import { EvaluateProposalManuallyUseCase } from '@/application/use-cases/evaluation/evaluate-proposal-manually';
import { asProposalId } from '@/domain/shared/ids';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const scores = Array.isArray(body?.scores) ? body.scores : [];
  const risks = Array.isArray(body?.risks) ? body.risks : [];
  const financials = Array.isArray(body?.financials) ? body.financials : [];

  if (!proposalId) {
    return NextResponse.json({ error: 'proposalId es obligatorio.' }, { status: 400 });
  }

  const useCase = new EvaluateProposalManuallyUseCase(
    new SupabaseEvaluationCatalogRepository(supabase),
    new SupabaseEvaluationResultRepository(supabase, profile.tenantId, profile.organizationId),
  );

  try {
    const outcome = await useCase.execute({
      organizationId: profile.organizationId,
      proposalId: asProposalId(proposalId),
      scores,
      risks,
      financials,
    });

    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
