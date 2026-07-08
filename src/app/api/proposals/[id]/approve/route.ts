// src/app/api/proposals/[id]/approve/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('id, recommendation, submitted_at, approved_at')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
  if (proposal.approved_at) {
    return NextResponse.json({ error: 'Esta propuesta ya estaba aprobada.' }, { status: 409 });
  }
  if (!proposal.recommendation) {
    return NextResponse.json({ error: 'Evalúa la propuesta antes de aprobarla.' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update({
      approved_at: new Date().toISOString(),
      rejected_at: null,
      submitted_at: proposal.submitted_at ?? new Date().toISOString(),
    })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
