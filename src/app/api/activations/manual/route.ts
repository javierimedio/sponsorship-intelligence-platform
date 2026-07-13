// src/app/api/activations/manual/route.ts
// Añade UNA acción de activación (no reemplaza el plan entero — se puede llamar varias
// veces para ir construyendo la lista, incluso repitiendo el mismo catálogo).

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseActivationResultRepository } from '@/infrastructure/supabase/activation-repository';
import { AddActivationActionUseCase } from '@/application/use-cases/activation/add-activation-action';
import { asProposalId } from '@/domain/shared/ids';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const activationCatalogItemId = typeof body?.activationCatalogItemId === 'string' ? body.activationCatalogItemId : '';

  if (!proposalId || !activationCatalogItemId) {
    return NextResponse.json({ error: 'proposalId y activationCatalogItemId son obligatorios.' }, { status: 400 });
  }

  const useCase = new AddActivationActionUseCase(
    new SupabaseActivationResultRepository(supabase, profile.tenantId, profile.organizationId),
  );

  try {
    const action = await useCase.execute({
      proposalId: asProposalId(proposalId),
      action: {
        activationCatalogItemId,
        channelId: body.channelId || null,
        objective: body.objective || null,
        description: body.description || null,
        priority: body.priority || null,
        expectedImpact: body.expectedImpact || null,
        effort: body.effort || null,
        responsible: body.responsible || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        kpiDefinitionId: body.kpiDefinitionId || null,
        kpiName: body.kpiName || null,
        kpiTarget: body.kpiTarget || null,
        isReusable: typeof body.isReusable === 'boolean' ? body.isReusable : null,
        usefulLife: body.usefulLife || null,
      },
    });
    return NextResponse.json(action);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
