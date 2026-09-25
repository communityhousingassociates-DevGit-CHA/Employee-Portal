-- CHA Employee Portal — Migration 025: audit trail for corrected salary entries
--
-- A salary entry can now be edited in place (fixing a wrong amount, date, or note). To keep the history trustworthy,
-- an edit records who made it, when, and what the amount was before.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table employee_salaries add column if not exists previous_annual_salary numeric;
alter table employee_salaries add column if not exists edited_by uuid references employees(id);
alter table employee_salaries add column if not exists edited_at timestamptz;
