// src/app/api/proposals/[id]/request-review/route.ts
// "Solicitar revisión": reutiliza submitted_at (columna ya existente) en vez de crear
// un estado nuevo — volver a null la deja editable de nuevo, exactamente como un Borrador.

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
    .select('id, approved_at, finalized_at')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
  if (proposal.approved_at || proposal.finalized_at) {
    return NextResponse.json({ error: 'Una propuesta aprobada o finalizada no puede volver a revisión.' }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update({ submitted_at: null, rejected_at: null })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
