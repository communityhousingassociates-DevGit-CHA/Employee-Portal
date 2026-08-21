-- CHA Employee Portal — Migration 005: portal-generated employee ID
-- Auto-incrementing, human-readable, NOT tied to any external HR/payroll
-- system (confirmed with client) and NOT part of the bulk-import
-- spreadsheet mapping — `generated always` rejects any client-supplied
-- value at the DB level.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

alter table employees add column if not exists employee_number integer;

update employees e
set employee_number = 1000 + sub.rn
from (
  select id, row_number() over (order by hire_date, created_at) as rn
  from employees
  where employee_number is null
) sub
where e.id = sub.id;

alter table employees alter column employee_number set not null;

-- Start well above the backfilled range (1001..~1030) to avoid collision.
alter table employees
  alter column employee_number add generated always as identity (start with 5001);

alter table employees
  add constraint employees_employee_number_key unique (employee_number);
