-- CHA Employee Portal — Migration 021: balance snapshots + manual adjustments
--
-- The portal is the live ledger; Sage lags by about a pay period. To reconcile the two each cycle:
--   * `balance_snapshots` — when accounting closes a range of dates (Close Period), every employee's PTO/Sick/Vacation
--     balances AS OF the last closed date are saved. That closing number is what Sage should show once it has processed
--     the same period, so the two can be compared without disturbing live balances.
--   * `balance_adjustments` gains `kind` ('override' from a file, 'adjustment' entered by hand or from a reconciliation)
--     and `reason`, so a prior-period correction has a documented home that doesn't reopen closed time.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  closed_period_id uuid references closed_periods(id) on delete cascade,
  as_of date not null,
  employee_id uuid not null references employees(id),
  pto numeric not null,
  sick numeric not null,
  vacation numeric not null,
  taken_by uuid references employees(id),
  taken_at timestamptz not null default now()
);

create unique index if not exists balance_snapshots_period_employee_uniq on balance_snapshots (closed_period_id, employee_id);
create index if not exists balance_snapshots_employee_asof_idx on balance_snapshots (employee_id, as_of desc);

alter table balance_snapshots enable row level security;
create policy "balance_snapshots_managers_read" on balance_snapshots for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

alter table balance_adjustments add column if not exists kind text not null default 'override' check (kind in ('override', 'adjustment'));
alter table balance_adjustments add column if not exists reason text;
