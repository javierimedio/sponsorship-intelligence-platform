// src/app/api/proposals/[id]/reject/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('id, recommendation, approved_at, finalized_at')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
  if (proposal.finalized_at) {
    return NextResponse.json({ error: 'No se puede rechazar una propuesta ya finalizada.' }, { status: 409 });
  }
  if (proposal.approved_at) {
    return NextResponse.json({ error: 'No se puede rechazar una propuesta ya aprobada.' }, { status: 409 });
  }
  if (!proposal.recommendation) {
    return NextResponse.json({ error: 'Evalúa la propuesta antes de poder rechazarla.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const rejectionReason = typeof body?.reason === 'string' ? body.reason.trim() : null;

  const { error: updateError } = await supabase
    .from('proposals')
    .update({ rejected_at: new Date().toISOString(), rejection_reason: rejectionReason })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
