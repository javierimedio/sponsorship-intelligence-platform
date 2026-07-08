// src/app/api/activations/manual/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseActivationResultRepository } from '@/infrastructure/supabase/activation-repository';
import { SelectActivationsManuallyUseCase } from '@/application/use-cases/activation/select-activations-manually';
import { asProposalId } from '@/domain/shared/ids';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const activationCatalogItemIds = Array.isArray(body?.activationCatalogItemIds)
    ? body.activationCatalogItemIds
    : [];
  const notes = typeof body?.notes === 'string' ? body.notes : '';

  if (!proposalId) {
    return NextResponse.json({ error: 'proposalId es obligatorio.' }, { status: 400 });
  }

  const useCase = new SelectActivationsManuallyUseCase(
    new SupabaseActivationResultRepository(supabase, profile.tenantId, profile.organizationId),
  );

  try {
    await useCase.execute({ proposalId: asProposalId(proposalId), activationCatalogItemIds, notes });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
