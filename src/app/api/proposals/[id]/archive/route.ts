// src/app/api/proposals/[id]/archive/route.ts
// Archivar es ortogonal al resto del ciclo de vida (no es una decisión, es limpieza del
// pipeline activo) — se permite desde cualquier estado, incluso ya finalizada.

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

  const { error } = await supabase
    .from('proposals')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
