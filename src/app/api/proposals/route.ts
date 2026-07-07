// src/app/api/proposals/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseProposalRepository } from '@/infrastructure/supabase/proposal-repository';
import { CreateProposalUseCase } from '@/application/use-cases/intake/create-proposal';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';

  if (!title) {
    return NextResponse.json({ error: 'El título es obligatorio.' }, { status: 400 });
  }

  const useCase = new CreateProposalUseCase(new SupabaseProposalRepository(supabase));

  try {
    const proposal = await useCase.execute({
      tenantId: profile.tenantId,
      organizationId: profile.organizationId,
      title,
      createdBy: profile.userId,
    });

    return NextResponse.json({
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      organizationId: proposal.organizationId,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const repository = new SupabaseProposalRepository(supabase);
  const proposals = await repository.findAllByOrganization(profile.organizationId);

  return NextResponse.json(
    proposals.map((p) => ({ id: p.id, title: p.title, status: p.status, createdAt: p.createdAt })),
  );
}
