// src/app/api/activation-catalog/route.ts

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseActivationCatalogRepository } from '@/infrastructure/supabase/activation-repository';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  try {
    const repository = new SupabaseActivationCatalogRepository(supabase);
    const [items, channels, kpiDefinitions] = await Promise.all([
      repository.getCatalogItems(profile.organizationId),
      repository.getChannels(profile.organizationId),
      repository.getKpiDefinitions(profile.organizationId),
    ]);
    return NextResponse.json({ items, channels, kpiDefinitions });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
