// src/app/api/brands/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .eq('organization_id', profile.organizationId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'El nombre de la marca es obligatorio.' }, { status: 400 });
  }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .insert({
      organization_id: profile.organizationId,
      name,
      website: body?.website || null,
      social_instagram: body?.socialInstagram || null,
      social_facebook: body?.socialFacebook || null,
      social_youtube: body?.socialYoutube || null,
    })
    .select('id')
    .single();

  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }

  // El perfil de IA se crea con lo básico ya conocido — el resto se rellena luego desde
  // /brands/[id]/edit, a mano o con el botón de completar con IA.
  const { error: contextError } = await supabase.from('brand_ai_context').insert({
    brand_id: brand.id,
    business_model: body?.businessModel || null,
    target_audience: body?.targetAudience || null,
  });

  if (contextError) {
    return NextResponse.json({ error: contextError.message }, { status: 500 });
  }

  return NextResponse.json({ id: brand.id });
}
