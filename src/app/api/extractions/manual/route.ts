// src/app/api/extractions/manual/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseAiExtractionRepository } from '@/infrastructure/supabase/ai-extraction-repository';
import { SupabaseProposalRepository } from '@/infrastructure/supabase/proposal-repository';
import { SaveManualExtractionUseCase } from '@/application/use-cases/intake/save-manual-extraction';
import { asDocumentId, asProposalId } from '@/domain/shared/ids';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const documentId = typeof body?.documentId === 'string' ? body.documentId : '';
  const extractedJson = body?.extractedJson;

  if (!proposalId || !extractedJson || typeof extractedJson !== 'object') {
    return NextResponse.json({ error: 'proposalId y extractedJson son obligatorios.' }, { status: 400 });
  }

  const useCase = new SaveManualExtractionUseCase(
    new SupabaseAiExtractionRepository(supabase),
    new SupabaseProposalRepository(supabase),
  );

  try {
    await useCase.execute({
      tenantId: profile.tenantId,
      organizationId: profile.organizationId,
      proposalId: asProposalId(proposalId),
      documentId: documentId ? asDocumentId(documentId) : null,
      extractedJson,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
