-- ProffPulse Supabase PostgreSQL Schema (for optional cloud mistake persistence)

create table if not exists public.mistake_logs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  question_id text not null,
  module_id text not null,
  subject text not null,
  topic text not null,
  question_json jsonb not null,
  miss_count integer not null default 1,
  last_missed_at timestamptz not null default now(),
  unique (client_id, question_id)
);

create index if not exists idx_mistake_logs_client_module
  on public.mistake_logs (client_id, module_id, last_missed_at desc);
