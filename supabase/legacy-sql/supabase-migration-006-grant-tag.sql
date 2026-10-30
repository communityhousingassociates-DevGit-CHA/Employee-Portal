-- CHA Employee Portal — Migration 006: grant/funding-source tagging
-- Groundwork for future cost-allocation reporting (not actively used yet,
-- per client). A lookup table rather than a hardcoded enum so CHA can
-- add/rename grants without a code deploy.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

create table if not exists grants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table employees add column if not exists grant_id uuid references grants(id);

alter table grants enable row level security;
create policy "grants_read_all_authenticated" on grants for select using (true);
