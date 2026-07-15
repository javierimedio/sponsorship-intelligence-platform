// src/app/api/enrich-web/route.ts
// Botón explícito, nunca automático — cada búsqueda tiene coste y tarda más que las
// llamadas normales de los Agentes 2-5. Trabaja sobre los datos que ya hay escritos en el
// formulario, antes incluso de guardar la extracción — no necesita que la propuesta exista
// todavía en base de datos.

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

  try {
    // Solo OpenAI implementado por ahora — es el único proveedor con facturación activa
    // disponible para validar esto con casos reales antes de extenderlo a los demás.
    const provider = getAIProvider('openai');
    const summary = await provider.enrichWithWebSearch({
      requesterName: body?.requesterName || null,
      website: body?.website || null,
      socialInstagram: body?.socialInstagram || null,
      socialFacebook: body?.socialFacebook || null,
      socialYoutube: body?.socialYoutube || null,
      brandName: body?.brandName || null,
    });
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
