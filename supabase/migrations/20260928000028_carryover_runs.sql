-- CHA Employee Portal — Migration 028: year-end leave carryover
--
-- SOP §4: unused annual + personal + sick leave carries over up to a COMBINED limit (240 hrs under 60 months of tenure,
-- 400 hrs after; the CEO is exempt). The daily job applies it once, in January, for the year that just ended.
-- `carryover_runs` records that a year has been processed so a re-run (or a later January accrual) never trims twice.
-- The per-employee trims themselves are written to `balance_adjustments` (kind 'adjustment') for the audit trail.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists carryover_runs (
  year int primary key,                -- the year whose balances were carried INTO (e.g. 2027 = Dec 31 2026 → Jan 1 2027)
  ran_at timestamptz not null default now(),
  employees_trimmed int not null default 0,
  hours_forfeited numeric not null default 0
);

alter table carryover_runs enable row level security;
create policy "carryover_runs_managers_read" on carryover_runs for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));
