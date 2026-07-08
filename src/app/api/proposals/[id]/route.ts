// src/app/api/proposals/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('proposals')
    .select('id, submitted_at')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
  if (existing.submitted_at) {
    return NextResponse.json({ error: 'Esta propuesta ya fue enviada y no se puede editar.' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (typeof body?.title === 'string' && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if ('brandId' in (body ?? {})) {
    updates.brand_id = body.brandId || null;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase.from('proposals').update(updates).eq('id', params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
