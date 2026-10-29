-- SECURITY: the portal writes to the database only from server code using the service-role key (which bypasses RLS). The
-- browser's anon/authenticated roles never need to write public tables — but Supabase grants them INSERT/UPDATE/DELETE by default,
-- and four tables carried FOR ALL policies ("employee_id = me"). That let any signed-in employee, using their own session and the
-- public anon key, update their OWN rows directly — e.g. set status = 'approved' on their own leave request, expense or timesheet,
-- or change an expense amount after approval — skipping every server-side check.
--
-- Fix: read-only from the client. Replace the FOR ALL policies with SELECT-only ones (same visibility as before) and revoke the
-- write grants. Server actions keep working (service role). Verified before writing: no browser code calls insert/update/delete.

drop policy if exists "employees_own" on public.leave_requests;
create policy "leave_requests_select_own_or_manager" on public.leave_requests for select
  using (employee_id = current_employee_id() or current_employee_role() = any (array['ceo','admin','accounting_manager']));

drop policy if exists "timesheets_own" on public.timesheets;
create policy "timesheets_select_own_or_manager" on public.timesheets for select
  using (employee_id = current_employee_id() or current_employee_role() = any (array['ceo','admin','accounting_manager']));

drop policy if exists "expenses_self_or_manager" on public.expenses;
create policy "expenses_select_own_or_manager" on public.expenses for select
  using (employee_id = current_employee_id() or current_employee_role() = any (array['accounting_manager','ceo','admin']));

drop policy if exists "issue_reports_self_or_manager" on public.issue_reports;
create policy "issue_reports_select_own_or_manager" on public.issue_reports for select
  using (
    employee_id = (select e.id from public.employees e where e.user_id = auth.uid())
    or exists (select 1 from public.employees e where e.user_id = auth.uid() and e.role = any (array['accounting_manager','ceo','admin']))
  );

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
