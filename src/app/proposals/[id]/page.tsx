// src/app/proposals/[id]/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { SubmitProposalButton } from './submit-button';

interface PageProps {
  params: { id: string };
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, brands(name)')
    .eq('id', params.id)
    .maybeSingle();

  if (!proposal) {
    return (
      <AppShell>
        <p>Propuesta no encontrada (o no tienes acceso desde tu organización).</p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </AppShell>
    );
  }

  const [
    { data: extraction },
    { data: scores },
    { data: risks },
    { data: financials },
    { data: documents },
    { data: activations },
  ] = await Promise.all([
    supabase
      .from('ai_extractions')
      .select('extracted_json, model_used, created_at')
      .eq('proposal_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('proposal_scores')
      .select('score_value, ai_rationale, source, scoring_attributes(name, max_score, scoring_blocks(name))')
      .eq('proposal_id', params.id),
    supabase
      .from('proposal_risks')
      .select('level, impact, computed_score, source, risk_factors(name, risk_blocks(name))')
      .eq('proposal_id', params.id),
    supabase
      .from('proposal_financials')
      .select('estimated_amount, source, economic_concepts(name, nature, block_type)')
      .eq('proposal_id', params.id),
    supabase
      .from('documents')
      .select('id, storage_path, original_filename, document_type, uploaded_at')
      .eq('proposal_id', params.id)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('proposal_activations')
      .select('notes, source, activation_catalog_items(area, name)')
      .eq('proposal_id', params.id),
  ]);

  // Genera enlaces de descarga temporales (1h) — el bucket es privado, RLS de storage.objects
  // exige que el primer segmento de la ruta sea tu organization_id, igual que en la subida.
  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractedJson = (extraction?.extracted_json ?? {}) as Record<string, any>;
  const hasSocial = extractedJson.social_facebook || extractedJson.social_instagram || extractedJson.social_youtube;

  return (
    <AppShell>
      <p>
        <Link href="/proposals">← Volver a propuestas</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{proposal.title}</h1>
          <p style={{ color: 'var(--c-mid)', margin: 0 }}>
            {proposal.brands?.name ?? 'Corporativo (Gor Factory)'} · Estado:{' '}
            <span className={`status s-${proposal.status}`}>{proposal.status}</span>{' '}
            {proposal.submitted_at ? (
              <span className="status s-evaluated" style={{ marginLeft: 6 }}>
                Enviada el {new Date(proposal.submitted_at).toLocaleDateString('es-ES')}
              </span>
            ) : (
              <span className="status s-extracting" style={{ marginLeft: 6 }}>
                Borrador
              </span>
            )}
          </p>
        </div>
        {!proposal.submitted_at && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/proposals/${proposal.id}/edit`} className="btn btn-outline">
              ✏️ Editar
            </Link>
            {proposal.recommendation && <SubmitProposalButton proposalId={proposal.id} />}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Resultado de la evaluación</div>
        <div className="stat-block">
          <div>
            <div className="stat-label">Score total</div>
            <div className="stat-value">
              {proposal.total_score !== null ? `${(Number(proposal.total_score) * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="stat-label">Riesgo global</div>
            <div className="stat-value">{proposal.overall_risk_level ?? '—'}</div>
          </div>
          <div>
            <div className="stat-label">Recomendación</div>
            <div className="stat-value">{proposal.recommendation ?? '—'}</div>
          </div>
        </div>
      </div>

      {extraction && (
        <div className="card">
          <div className="card-title">Extracción ({extraction.model_used})</div>
          <p>
            <strong>Solicitante:</strong> {extractedJson.requester_name ?? '—'} ({extractedJson.requester_org ?? '—'})
          </p>
          <p>
            <strong>Tipo de colaboración:</strong> {extractedJson.collaboration_type ?? '—'}
          </p>
          <p>
            <strong>Resumen:</strong> {extractedJson.summary ?? '—'}
          </p>
          <p>
            <strong>Importe estimado:</strong> {extractedJson.estimated_total_amount ?? '—'}{' '}
            {extractedJson.currency ?? ''}
          </p>
          {extractedJson.website && (
            <p>
              <strong>Web:</strong>{' '}
              <a href={extractedJson.website} target="_blank" rel="noopener noreferrer">
                {extractedJson.website}
              </a>
            </p>
          )}
          {hasSocial && (
            <p>
              <strong>Redes sociales:</strong>{' '}
              {extractedJson.social_facebook && (
                <a href={extractedJson.social_facebook} target="_blank" rel="noopener noreferrer" style={{ marginRight: 10 }}>
                  Facebook
                </a>
              )}
              {extractedJson.social_instagram && (
                <a href={extractedJson.social_instagram} target="_blank" rel="noopener noreferrer" style={{ marginRight: 10 }}>
                  Instagram
                </a>
              )}
              {extractedJson.social_youtube && (
                <a href={extractedJson.social_youtube} target="_blank" rel="noopener noreferrer">
                  YouTube
                </a>
              )}
            </p>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Documentos adjuntos</div>
        {!documentsWithUrls.length ? (
          <p style={{ color: 'var(--c-mid)', margin: 0 }}>No hay documentos adjuntos.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {documentsWithUrls.map((doc) => (
              <li
                key={doc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--c-line)',
                }}
              >
                <span>{doc.original_filename ?? doc.storage_path.split('/').pop()}</span>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    Descargar
                  </a>
                ) : (
                  <span style={{ color: 'var(--c-red)', fontSize: 12 }}>No disponible</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-title">Scoring por atributo</div>
        <table>
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Atributo</th>
              <th>Puntuación</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {(scores ?? []).map((s: any, i: number) => (
              <tr key={i}>
                <td>{s.scoring_attributes?.scoring_blocks?.name}</td>
                <td>{s.scoring_attributes?.name}</td>
                <td>
                  {Number(s.score_value).toFixed(3)} / {s.scoring_attributes?.max_score}
                </td>
                <td>{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Factores de riesgo</div>
        <table>
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Factor</th>
              <th>Nivel</th>
              <th>Impacto</th>
              <th>Puntuación</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {(risks ?? []).map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.risk_factors?.risk_blocks?.name}</td>
                <td>{r.risk_factors?.name}</td>
                <td>{r.level}</td>
                <td>{r.impact}</td>
                <td>{r.computed_score}</td>
                <td>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Costes-ROI</div>
        <table>
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Concepto</th>
              <th>Naturaleza</th>
              <th>Importe</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {(financials ?? []).map((f: any, i: number) => (
              <tr key={i}>
                <td>{f.economic_concepts?.block_type ?? '—'}</td>
                <td>{f.economic_concepts?.name}</td>
                <td>{f.economic_concepts?.nature === 'cost' ? 'Coste' : 'Resultado'}</td>
                <td>{f.estimated_amount !== null ? `${Number(f.estimated_amount).toLocaleString('es-ES')} €` : '—'}</td>
                <td>{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Plan de activación</div>
        {!activations?.length ? (
          <p style={{ color: 'var(--c-mid)', margin: 0 }}>Sin plan de activación definido.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Área</th>
                <th>Acción</th>
                <th>Notas</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {activations.map((a: any, i: number) => (
                <tr key={i}>
                  <td>{a.activation_catalog_items?.area}</td>
                  <td>{a.activation_catalog_items?.name}</td>
                  <td>{a.notes || '—'}</td>
                  <td>{a.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
