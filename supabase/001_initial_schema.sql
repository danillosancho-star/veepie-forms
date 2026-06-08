-- ══════════════════════════════════════════════════════
-- Veepie Forms — Schema inicial
-- Rode no Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- Extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────
-- TENANTS
-- Cada cliente Veepie Forms é um tenant
-- ──────────────────────────────────────────────────────
create table if not exists tenants (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  slug                    text not null unique,       -- ex: "vitalab"
  monday_board_id         text not null,
  monday_token_encrypted  text not null,              -- criptografado em repouso
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────
-- FUNCTION SCHEMAS
-- Schema de competências por função, por tenant
-- Armazenado como JSONB para flexibilidade total
-- ──────────────────────────────────────────────────────
create table if not exists function_schemas (
  id                      uuid primary key default uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  external_id             text not null,              -- ex: "farmaceutico_bioquimico"
  title                   text not null,              -- ex: "Farmacêutico Bioquímico"
  monday_function_value   text not null,              -- valor exato no dropdown Monday
  competencies            jsonb not null default '[]',
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(tenant_id, external_id)
);

-- ──────────────────────────────────────────────────────
-- EVALUATION TOKENS
-- Um token por avaliação. É o que vira o link único.
-- ──────────────────────────────────────────────────────
create table if not exists evaluation_tokens (
  id                      uuid primary key default uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  monday_item_id          text not null,
  monday_board_id         text not null,
  function_schema_id      uuid not null references function_schemas(id),
  collaborator_name       text not null,
  evaluator_email         text not null,
  evaluator_name          text not null,
  coordinator_email       text not null,
  status                  text not null default 'pending'
                            check (status in ('pending','opened','submitted','expired')),
  expires_at              timestamptz not null,
  opened_at               timestamptz,
  submitted_at            timestamptz,
  created_at              timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────
-- FORM SUBMISSIONS
-- Respostas do avaliador
-- ──────────────────────────────────────────────────────
create table if not exists form_submissions (
  id                      uuid primary key default uuid_generate_v4(),
  token_id                uuid not null references evaluation_tokens(id) on delete cascade,
  answers                 jsonb not null default '[]',  -- CompetencyAnswer[]
  improvement_notes       text,
  training_needs          text,
  evaluator_name          text not null,
  submitted_at            timestamptz not null default now(),
  monday_synced_at        timestamptz,                  -- quando foi gravado no Monday
  monday_sync_error       text                          -- erro se falhou
);

-- ──────────────────────────────────────────────────────
-- SIGNATURE RECORDS
-- Uma linha por assinatura capturada
-- ──────────────────────────────────────────────────────
create table if not exists signature_records (
  id                      uuid primary key default uuid_generate_v4(),
  token_id                uuid not null references evaluation_tokens(id) on delete cascade,
  signer_name             text not null,
  signer_role             text not null check (signer_role in ('evaluator','coordinator')),
  ip_address              inet not null,
  user_agent              text,
  document_hash           text not null,  -- SHA-256 hex do conteúdo do formulário
  png_base64              text not null,  -- assinatura manuscrita (PNG)
  monday_file_id          text,           -- ID retornado pelo Monday após upload
  signed_at               timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────
-- AUDIT LOGS
-- Imutável. Nunca deletar linhas.
-- ──────────────────────────────────────────────────────
create table if not exists audit_logs (
  id                      uuid primary key default uuid_generate_v4(),
  token_id                uuid references evaluation_tokens(id),
  tenant_id               uuid references tenants(id),
  action                  text not null,
  actor_ip                inet,
  actor_agent             text,
  metadata                jsonb,
  created_at              timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────
-- ÍNDICES
-- ──────────────────────────────────────────────────────
create index if not exists idx_evaluation_tokens_tenant   on evaluation_tokens(tenant_id);
create index if not exists idx_evaluation_tokens_status   on evaluation_tokens(status);
create index if not exists idx_evaluation_tokens_expires  on evaluation_tokens(expires_at);
create index if not exists idx_evaluation_tokens_item     on evaluation_tokens(monday_item_id);
create index if not exists idx_form_submissions_token     on form_submissions(token_id);
create index if not exists idx_signature_records_token    on signature_records(token_id);
create index if not exists idx_audit_logs_token           on audit_logs(token_id);
create index if not exists idx_audit_logs_tenant          on audit_logs(tenant_id);
create index if not exists idx_audit_logs_action          on audit_logs(action);
create index if not exists idx_function_schemas_tenant    on function_schemas(tenant_id);

-- ──────────────────────────────────────────────────────
-- FUNÇÃO: expirar tokens vencidos
-- Chamar via pg_cron ou cron job externo (diário)
-- ──────────────────────────────────────────────────────
create or replace function expire_tokens()
returns void
language plpgsql
as $$
begin
  update evaluation_tokens
  set status = 'expired'
  where status in ('pending', 'opened')
    and expires_at < now();
end;
$$;

-- ──────────────────────────────────────────────────────
-- FUNÇÃO: updated_at automático
-- ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on tenants
  for each row execute function set_updated_at();

create trigger function_schemas_updated_at
  before update on function_schemas
  for each row execute function set_updated_at();

-- ──────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- O backend acessa via service_role (bypass RLS).
-- RLS está ativo para bloquear acesso direto não autorizado.
-- ──────────────────────────────────────────────────────
alter table tenants            enable row level security;
alter table function_schemas   enable row level security;
alter table evaluation_tokens  enable row level security;
alter table form_submissions   enable row level security;
alter table signature_records  enable row level security;
alter table audit_logs         enable row level security;

-- Service role tem acesso total (backend NestJS usa service_role key)
create policy "service_role full access" on tenants
  using (true) with check (true);
create policy "service_role full access" on function_schemas
  using (true) with check (true);
create policy "service_role full access" on evaluation_tokens
  using (true) with check (true);
create policy "service_role full access" on form_submissions
  using (true) with check (true);
create policy "service_role full access" on signature_records
  using (true) with check (true);
create policy "service_role full access" on audit_logs
  using (true) with check (true);

-- ──────────────────────────────────────────────────────
-- SEED: tenant Vitalab (substitua o token real)
-- ──────────────────────────────────────────────────────
insert into tenants (name, slug, monday_board_id, monday_token_encrypted)
values (
  'Vitalab',
  'vitalab',
  '18406881785',
  'MONDAY_TOKEN_PLACEHOLDER'  -- substituir pelo token criptografado
) on conflict (slug) do nothing;
