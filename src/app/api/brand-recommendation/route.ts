// src/app/api/brand-recommendation/route.ts

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
    // Solo OpenAI implementado por ahora — mismo motivo que el enriquecimiento web.
    const provider = getAIProvider('openai');
    const recommendation = await provider.recommendForBrand({
      brandName: body.brandName,
      positioning: body.positioning ?? null,
      idealCollaborations: body.idealCollaborations ?? null,
      avoidCollaborations: body.avoidCollaborations ?? null,
      strategicPriorities: body.strategicPriorities ?? null,
      evaluationBias: body.evaluationBias ?? null,
      decisionStyle: body.decisionStyle ?? null,
      historicalBreakdown: Array.isArray(body.historicalBreakdown) ? body.historicalBreakdown : [],
    });
    return NextResponse.json({ recommendation });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
