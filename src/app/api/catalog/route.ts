// src/app/api/catalog/route.ts

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseEvaluationCatalogRepository } from '@/infrastructure/supabase/evaluation-repository';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const repository = new SupabaseEvaluationCatalogRepository(supabase);
  const catalog = await repository.getCatalog(profile.organizationId);

  return NextResponse.json(catalog);
}
