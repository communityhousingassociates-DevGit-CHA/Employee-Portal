-- CHA Employee Portal — Migration 007: salary history
-- Deliberately NOT a column on `employees` — keeps salary out of any
-- general SELECT on that table (e.g. the Admin Users list); only reachable
-- through the dedicated gated functions in src/app/actions/salary.ts.
-- History (not a single overwritable row) so a raise doesn't destroy the
-- prior compensation record — useful for audit/funder visibility.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

create table if not exists employee_salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  annual_salary numeric not null,
  effective_date date not null,
  note text,
  created_by uuid references employees(id),
  created_at timestamptz default now(),
  unique (employee_id, effective_date)
);

-- "Current" = most recent row whose effective_date has already passed —
-- lets a raise be entered ahead of time without taking effect early.
create or replace view employee_current_salary as
select distinct on (employee_id)
  employee_id, annual_salary, effective_date, note
from employee_salaries
where effective_date <= current_date
order by employee_id, effective_date desc;

alter table employee_salaries enable row level security;
create policy "salaries_self_or_manager" on employee_salaries for select
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('accounting_manager','ceo','admin')));
