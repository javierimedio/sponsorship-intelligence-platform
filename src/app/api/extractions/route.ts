// src/app/api/extractions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { SupabaseAiExtractionRepository } from '@/infrastructure/supabase/ai-extraction-repository';
import { SupabaseProposalRepository } from '@/infrastructure/supabase/proposal-repository';
import { getAIProvider } from '@/infrastructure/ai/get-ai-provider';
import { RunExtractionAgentUseCase } from '@/application/use-cases/intake/run-extraction-agent';
import { asDocumentId, asProposalId } from '@/domain/shared/ids';

function inferMediaType(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : '';
  const documentId = typeof body?.documentId === 'string' ? body.documentId : '';
  const storagePath = typeof body?.storagePath === 'string' ? body.storagePath : '';
  const provider = typeof body?.provider === 'string' ? body.provider : undefined;

  if (!proposalId || !storagePath) {
    return NextResponse.json({ error: 'proposalId y storagePath son obligatorios.' }, { status: 400 });
  }

  // Descarga el archivo real de Storage con la sesión del propio usuario — la RLS de
  // storage.objects ya exige que el primer segmento de la ruta sea su organization_id.
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (downloadError || !fileBlob) {
    return NextResponse.json(
      { error: `No se pudo descargar el documento: ${downloadError?.message ?? 'desconocido'}` },
      { status: 500 },
    );
  }

  const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
  const mediaType = inferMediaType(storagePath);

  const useCase = new RunExtractionAgentUseCase(
    new SupabaseAiExtractionRepository(supabase),
    new SupabaseProposalRepository(supabase),
    getAIProvider(provider),
  );

  try {
    const extractedJson = await useCase.execute({
      tenantId: profile.tenantId,
      organizationId: profile.organizationId,
      proposalId: asProposalId(proposalId),
      documentId: documentId ? asDocumentId(documentId) : null,
      fileBuffer,
      mediaType,
    });

    return NextResponse.json({ extractedJson });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
