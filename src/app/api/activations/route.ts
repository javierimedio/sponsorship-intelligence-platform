// src/app/api/activations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseActivationResultRepository } from '@/infrastructure/supabase/activation-repository';
import { asProposalId } from '@/domain/shared/ids';

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const proposalId = request.nextUrl.searchParams.get('proposalId');
  if (!proposalId) {
    return NextResponse.json({ error: 'proposalId es obligatorio.' }, { status: 400 });
  }

  try {
    const repository = new SupabaseActivationResultRepository(supabase, profile.tenantId, profile.organizationId);
    const actions = await repository.listActions(asProposalId(proposalId));
    return NextResponse.json(actions);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
