// src/app/api/activations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseActivationResultRepository } from '@/infrastructure/supabase/activation-repository';
import { UpdateActivationFollowUpUseCase } from '@/application/use-cases/activation/update-activation-followup';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const repository = new SupabaseActivationResultRepository(supabase, profile.tenantId, profile.organizationId);

  try {
    // Seguimiento (usado desde la ficha, tras aprobar la propuesta).
    if (body && (Object.prototype.hasOwnProperty.call(body, 'status') || Object.prototype.hasOwnProperty.call(body, 'kpiResult'))) {
      const useCase = new UpdateActivationFollowUpUseCase(repository);
      await useCase.execute({
        actionId: params.id,
        followUp: {
          status: typeof body.status === 'string' ? body.status : undefined,
          kpiResult: typeof body.kpiResult === 'string' ? body.kpiResult : undefined,
        },
      });
    }

    // Edición completa (usado al corregir una acción ya añadida al plan, antes de enviar).
    const fullEditKeys = [
      'activationCatalogItemId', 'channelId', 'objective', 'description', 'priority',
      'expectedImpact', 'effort', 'responsible', 'startDate', 'endDate',
      'kpiDefinitionId', 'kpiName', 'kpiTarget', 'isReusable', 'usefulLife',
    ];
    if (body && fullEditKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
      await repository.updateAction(params.id, {
        activationCatalogItemId: body.activationCatalogItemId,
        channelId: body.channelId,
        objective: body.objective,
        description: body.description,
        priority: body.priority,
        expectedImpact: body.expectedImpact,
        effort: body.effort,
        responsible: body.responsible,
        startDate: body.startDate,
        endDate: body.endDate,
        kpiDefinitionId: body.kpiDefinitionId,
        kpiName: body.kpiName,
        kpiTarget: body.kpiTarget,
        isReusable: body.isReusable,
        usefulLife: body.usefulLife,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  try {
    const repository = new SupabaseActivationResultRepository(supabase, profile.tenantId, profile.organizationId);
    await repository.deleteAction(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
