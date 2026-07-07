// src/app/api/evaluations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseAiExtractionRepository } from '@/infrastructure/supabase/ai-extraction-repository';
import {
  SupabaseEvaluationCatalogRepository,
  SupabaseEvaluationResultRepository,
} from '@/infrastructure/supabase/evaluation-repository';
import { getAIProvider } from '@/infrastructure/ai/get-ai-provider';
import { EvaluateProposalUseCase } from '@/application/use-cases/evaluation/evaluate-proposal';
import { asProposalId } from '@/domain/shared/ids';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';

  if (!proposalId) {
    return NextResponse.json({ error: 'proposalId es obligatorio.' }, { status: 400 });
  }

  const extractionRepository = new SupabaseAiExtractionRepository(supabase);
  const extractedData = await extractionRepository.findLatestExtractedJson(asProposalId(proposalId));

  if (!extractedData) {
    return NextResponse.json(
      { error: 'No hay ninguna extracción completada para esta propuesta todavía.' },
      { status: 400 },
    );
  }

  const useCase = new EvaluateProposalUseCase(
    new SupabaseEvaluationCatalogRepository(supabase),
    new SupabaseEvaluationResultRepository(supabase, profile.tenantId, profile.organizationId),
    getAIProvider(),
  );

  try {
    const outcome = await useCase.execute({
      organizationId: profile.organizationId,
      proposalId: asProposalId(proposalId),
      extractedData,
    });

    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
