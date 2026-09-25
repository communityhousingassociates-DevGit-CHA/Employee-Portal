-- CHA Employee Portal — Migration 019: leave balance overrides + accrual switch
--
--   * unique index on leave_balances(employee_id) — one balance row per employee, so an override can never
--     leave a second row behind (which would break every page that reads a person's balance).
--   * `balance_adjustments` — audit trail for the Balance Update tool: for each employee in a batch, the
--     balances before and after, the "as of" date of the source file, who applied it, and a note.
--   * `accrual_settings` — the on/off switch for PTO/sick accruals and the first pay period that should
--     accrue in the portal. Accruals stay OFF until an authorised user turns them on, so the daily job can
--     never add hours on top of balances loaded from CHA that already include them.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create unique index if not exists leave_balances_employee_uniq on leave_balances (employee_id);

create table if not exists balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  employee_id uuid not null references employees(id),
  as_of date not null,
  source_file text,
  old_pto numeric, old_sick numeric, old_personal numeric,
  new_pto numeric not null, new_sick numeric not null, new_personal numeric not null,
  note text,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);
create index if not exists balance_adjustments_batch_idx on balance_adjustments (batch_id);
create index if not exists balance_adjustments_employee_idx on balance_adjustments (employee_id, created_at desc);

alter table balance_adjustments enable row level security;
create policy "balance_adjustments_managers_read" on balance_adjustments for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

create table if not exists accrual_settings (
  id boolean primary key default true check (id), -- single row
  enabled boolean not null default false,
  first_period_start date,
  updated_by uuid references employees(id),
  updated_at timestamptz not null default now()
);
insert into accrual_settings (id) values (true) on conflict do nothing;

alter table accrual_settings enable row level security;
create policy "accrual_settings_managers_read" on accrual_settings for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));
