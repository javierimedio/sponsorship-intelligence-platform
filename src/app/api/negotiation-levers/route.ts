// src/app/api/negotiation-levers/route.ts

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('negotiation_levers')
    .select('id, name, description, score_delta, scoring_attribute_id, scoring_attributes(name, max_score, scoring_blocks(name))')
    .eq('organization_id', profile.organizationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
