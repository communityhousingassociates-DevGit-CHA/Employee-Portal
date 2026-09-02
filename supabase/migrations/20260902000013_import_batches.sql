-- CHA Employee Portal — Migration 013: import review queue
--
-- Backs the "alert the superadmin when an import needs review" feature.
-- Previously an admin's parsed/validated import lived only in browser
-- state — closing the tab lost it, and the review screen's "let them
-- know" message was pure copy with nothing behind it. This table lets an
-- admin persist a validated batch for a superadmin to actually open and
-- act on, from any session.
--
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  prepared_by uuid references employees(id) not null,
  status text not null default 'pending' check (status in ('pending', 'committed', 'discarded')),
  employee_file_name text,
  balance_file_name text,
  salary_file_name text,
  employee_rows jsonb not null default '[]'::jsonb,
  balance_rows jsonb not null default '[]'::jsonb,
  salary_rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  committed_by uuid references employees(id),
  committed_at timestamptz
);

alter table import_batches enable row level security;

-- Admin-only, same defense-in-depth level as the rest of this app (the
-- app itself reads/writes exclusively through the service-role client —
-- see migration 004/012's own notes on this).
create policy "import_batches_admin_only" on import_batches for all
  using (public.current_employee_role() = 'admin');
