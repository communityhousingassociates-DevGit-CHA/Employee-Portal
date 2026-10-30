-- CHA Employee Portal — Migration 004: RLS hardening
-- Defense-in-depth only. The app exclusively reads/writes through the
-- service-role admin client (src/lib/supabase/admin.ts), which bypasses RLS
-- entirely, so none of this changes app behavior. It closes gaps that would
-- matter if an anon-key client is ever used against these tables:
--   - `employees` has RLS enabled with zero policies (default-deny today).
--   - `leave_requests`/`timesheets` RLS omits `accounting_manager`, even
--     though the app's own role logic (Sidebar, Dashboard) already treats
--     accounting_manager as a manager role.
--   - `accrual_log` never had RLS enabled at all.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

create policy "employees_own" on employees for select
  using (user_id = auth.uid()
      or exists (select 1 from employees where user_id = auth.uid() and role in ('ceo', 'admin')));

drop policy if exists "employees_own" on leave_requests;
create policy "employees_own" on leave_requests for all
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('ceo', 'admin', 'accounting_manager')));

drop policy if exists "timesheets_own" on timesheets;
create policy "timesheets_own" on timesheets for all
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('ceo', 'admin', 'accounting_manager')));

alter table accrual_log enable row level security;
