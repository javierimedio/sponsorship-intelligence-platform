// src/app/api/brands/[id]/complete-profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { getAIProvider } from '@/infrastructure/ai/get-ai-provider';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.brandName) {
    return NextResponse.json({ error: 'brandName es obligatorio.' }, { status: 400 });
  }

  try {
    const provider = getAIProvider('openai'); // único implementado por ahora
    const fields = await provider.completeBrandProfile({
      brandName: body.brandName,
      website: body.website ?? null,
      socialInstagram: body.socialInstagram ?? null,
      socialFacebook: body.socialFacebook ?? null,
      socialYoutube: body.socialYoutube ?? null,
      businessModel: body.businessModel ?? null,
      targetAudience: body.targetAudience ?? null,
    });
    return NextResponse.json(fields);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
