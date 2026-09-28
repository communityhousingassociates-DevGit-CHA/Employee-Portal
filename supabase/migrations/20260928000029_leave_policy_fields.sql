-- CHA Employee Portal — Migration 029: leave-policy employee fields, flex time, Personal Days grant
--
--   * employees.is_exempt          FLSA exempt flag (SOP §4 holiday work): exempt staff who work a paid holiday earn flex
--                                  time; non-exempt staff are paid time-and-a-half. Everyone starts exempt; flip individuals.
--   * employees.is_director        Director vs non-director — drives the resignation-notice / payout rule (4 vs 2 weeks).
--   * employees.year_end_holiday   Each employee's choice of Christmas Eve or New Year's Eve as a paid holiday.
--   * leave_balances.flex_hours    Flex time earned by exempt staff for holiday work (1.5 × hours worked); usable as leave.
--   * flex_credits                 One row per credited holiday, so re-approving a timesheet never double-credits.
--   * personal_grants              Marks each January 1 grant of 24 Personal Days hours as done (like carryover_runs).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table employees add column if not exists is_exempt boolean not null default true;
alter table employees add column if not exists is_director boolean not null default false;
alter table employees add column if not exists year_end_holiday text check (year_end_holiday in ('christmas_eve', 'new_years_eve'));

alter table leave_balances add column if not exists flex_hours numeric not null default 0;

create table if not exists flex_credits (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  timesheet_id uuid references timesheets(id) on delete set null,
  work_date date not null,
  hours_worked numeric not null,
  hours_credited numeric not null,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);
alter table flex_credits enable row level security;
create policy "flex_credits_managers_read" on flex_credits for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

create table if not exists personal_grants (
  year int primary key,
  ran_at timestamptz not null default now(),
  employees_granted int not null default 0
);
alter table personal_grants enable row level security;
create policy "personal_grants_managers_read" on personal_grants for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

-- Hours actually worked on a paid holiday at CHA's request (salaried rows can't record this in Regular, which is calculated).
-- Exempt staff earn flex time = multiplier × these hours when the timesheet is approved; non-exempt staff are paid time-and-a-half.
alter table timesheet_rows add column if not exists holiday_worked_hours numeric not null default 0;
