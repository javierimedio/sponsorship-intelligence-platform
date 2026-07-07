-- 0001_tenants.sql
-- Nivel más alto de aislamiento: límite comercial (Grupo GOR, futuros clientes SaaS)

create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

comment on table tenants is
  'Límite de aislamiento comercial. Un tenant puede alojar varias organizaciones (empresas del grupo).';
