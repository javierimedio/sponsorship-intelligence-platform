-- 0010_documents_and_storage.sql

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  organization_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  storage_path text not null,
  document_type text not null default 'other',
  -- 'contract'|'annex'|'invoice'|'presentation'|'email'|'image'|'other' (catálogo abierto por ahora)
  original_filename text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create index idx_documents_proposal on documents(proposal_id);
create index idx_documents_org on documents(organization_id);

alter table documents enable row level security;

create policy documents_select on documents for select
  using (
    tenant_id = current_tenant()
    and (is_tenant_admin() or organization_id = current_org())
  );

create policy documents_insert on documents for insert
  with check (
    tenant_id = current_tenant()
    and organization_id = current_org()
  );

-- ── STORAGE ──────────────────────────────────────────────────────────────
-- Bucket privado. Aislamiento por organización mediante el primer segmento
-- de la ruta: {organization_id}/{proposal_id}/{filename}.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy storage_documents_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'organization_id')
  );

create policy storage_documents_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'organization_id')
  );

comment on table documents is
  'Metadatos de documentos subidos a una propuesta. El archivo real vive en Storage,
   bucket "documents", ruta {organization_id}/{proposal_id}/{filename}.';
