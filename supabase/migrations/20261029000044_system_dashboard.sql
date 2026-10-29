-- CHA Employee Portal — Migration 044: records behind the super-admin System dashboard
--
--   * job_runs     One row per run of a scheduled job (daily cron), so "did it run, and did it succeed?" can be answered.
--   * release_log  One row per production deploy (commit, message, author, when it went live) — the change log.
--   * app_errors   Server errors the app caught (kind 'server_error') and refusals shown to users such as a blocked submit
--                  (kind 'user_blocked'). Written from instrumentation.ts; messages only — no request bodies or headers.
--
-- All three are service-role only (RLS on, no policies); the System dashboard reads them on the server.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  ok boolean not null,
  summary text,
  detail jsonb
);
create index if not exists job_runs_job_idx on job_runs (job, started_at desc);

create table if not exists release_log (
  sha text primary key,
  message text not null,
  author text,
  branch text,
  committed_at timestamptz,
  deployed_at timestamptz not null default now(),
  env text not null default 'production'
);
create index if not exists release_log_deployed_idx on release_log (deployed_at desc);

create table if not exists app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('server_error', 'user_blocked')),
  message text not null,
  digest text,
  path text,
  route text,
  route_type text,
  method text
);
create index if not exists app_errors_created_idx on app_errors (created_at desc);

alter table job_runs enable row level security;
alter table release_log enable row level security;
alter table app_errors enable row level security;
