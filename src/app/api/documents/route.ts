// src/app/api/documents/route.ts
// Se llama DESPUÉS de que el archivo ya se subió directamente a Storage desde el cliente.
// Este endpoint solo registra los metadatos.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseDocumentRepository } from '@/infrastructure/supabase/document-repository';
import { RegisterDocumentUseCase } from '@/application/use-cases/intake/register-document';
import { asProposalId } from '@/domain/shared/ids';

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const storagePath = typeof body?.storagePath === 'string' ? body.storagePath : '';
  const originalFilename = typeof body?.originalFilename === 'string' ? body.originalFilename : undefined;

  if (!proposalId || !storagePath) {
    return NextResponse.json({ error: 'proposalId y storagePath son obligatorios.' }, { status: 400 });
  }

  const useCase = new RegisterDocumentUseCase(new SupabaseDocumentRepository(supabase));

  try {
    const document = await useCase.execute({
      tenantId: profile.tenantId,
      organizationId: profile.organizationId,
      proposalId: asProposalId(proposalId),
      storagePath,
      originalFilename,
      uploadedBy: profile.userId,
    });

    return NextResponse.json({ id: document.id, storagePath: document.storagePath });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
