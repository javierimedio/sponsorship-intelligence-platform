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
  const provider = typeof body?.provider === 'string' ? body.provider : undefined;

  if (!proposalId) {
    return NextResponse.json({ error: 'proposalId es obligatorio.' }, { status: 400 });
  }

  // Antes solo se descargaba el archivo "principal" — si un dossier en PDF se convertía a
  // varias imágenes (una por página) y la primera era la portada, la IA se quedaba sin
  // nada útil que leer. Ahora se descargan TODOS los documentos-fuente de la propuesta
  // (se excluyen los generados por la propia IA, que son salida, no entrada) y se pasan
  // todos juntos al proveedor.
  const { data: sourceDocuments, error: docsError } = await supabase
    .from('documents')
    .select('storage_path, document_type')
    .eq('proposal_id', proposalId)
    .neq('document_type', 'ai_generated');

  if (docsError) {
    return NextResponse.json({ error: `No se pudieron listar los documentos: ${docsError.message}` }, { status: 500 });
  }
  if (!sourceDocuments?.length) {
    return NextResponse.json({ error: 'Esta propuesta no tiene ningún documento adjunto todavía.' }, { status: 400 });
  }

  const files: { buffer: Buffer; mediaType: string }[] = [];
  for (const doc of sourceDocuments) {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from('documents').download(doc.storage_path);
    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: `No se pudo descargar "${doc.storage_path}": ${downloadError?.message ?? 'desconocido'}` },
        { status: 500 },
      );
    }
    files.push({ buffer: Buffer.from(await fileBlob.arrayBuffer()), mediaType: inferMediaType(doc.storage_path) });
  }

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
      files,
      providerName: (provider ?? process.env.AI_PROVIDER ?? 'gemini').toLowerCase(),
    });

    return NextResponse.json({ extractedJson });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
