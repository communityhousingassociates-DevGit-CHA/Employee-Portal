-- CHA Employee Portal — Migration 012: RLS security fixes
--
-- Three bugs found during a security audit (2026-08-21), each confirmed live
-- against the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY — embedded in
-- the client bundle by design, so anyone can call the REST API directly):
--
-- 1. CRITICAL — `employee_current_salary` leaked real annual salaries to
--    completely unauthenticated requests. Postgres views run with the
--    view *owner's* privileges by default (security_invoker = false),
--    which bypasses RLS on the underlying employee_salaries table
--    entirely — confirmed by fetching a real salary with zero auth.
--    Fix: security_invoker = true makes the view respect the querying
--    role's RLS, same as querying the table directly.
--
-- 2. HIGH — every "…own" policy on employees/leave_requests/timesheets/
--    leave_balances/employee_salaries/expenses does
--    `exists (select 1 from employees where user_id = auth.uid() and role in (...))`
--    — a subquery against `employees` itself, which re-triggers employees'
--    own RLS policy and recurses infinitely. Confirmed: any REST call
--    against these tables returns Postgres error 42P17 ("infinite
--    recursion detected in policy for relation employees"), for anon AND
--    authenticated alike. Currently harmless only because the app
--    exclusively reads/writes through the service-role client (bypasses
--    RLS — see migration 004's own comment) — but RLS provides zero real
--    defense-in-depth today, and will hard-break the first client-side
--    query ever added against these tables.
--    Fix: SECURITY DEFINER helper functions look up the caller's own
--    employee row without re-entering RLS (they run as the function
--    owner, which bypasses RLS the same way the service-role client
--    does), referenced by every policy instead of a raw subquery.
--
-- 3. MEDIUM — mileage_rates and grants each have a policy literally named
--    "..._read_all_authenticated" using `for select using (true)` — but
--    without a `to authenticated` clause, `using (true)` grants the
--    anon role read access too. Confirmed: the anon key fetched the
--    current mileage rate with zero auth. Low sensitivity today, but the
--    policy's own name says it shouldn't be possible, and grants (funding
--    source names) will leak the same way once populated.
--
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

-- ── 1. Fix the salary view ──────────────────────────────────────────────
alter view employee_current_salary set (security_invoker = true);

-- ── 2. Recursion-safe identity lookups ──────────────────────────────────
-- SECURITY DEFINER: runs as the function owner (postgres), which bypasses
-- RLS on `employees` the same way the app's service-role client already
-- does — so looking up the caller's own row here doesn't re-trigger
-- employees' own policy.
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from employees where user_id = auth.uid()
$$;

create or replace function public.current_employee_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from employees where user_id = auth.uid()
$$;

-- ── 3. Rewrite every recursive policy to use them instead ──────────────
drop policy if exists "employees_own" on employees;
create policy "employees_own" on employees for select
  using (user_id = auth.uid() or public.current_employee_role() in ('ceo', 'admin'));

drop policy if exists "employees_own" on leave_requests;
create policy "employees_own" on leave_requests for all
  using (employee_id = public.current_employee_id()
      or public.current_employee_role() in ('ceo', 'admin', 'accounting_manager'));

drop policy if exists "timesheets_own" on timesheets;
create policy "timesheets_own" on timesheets for all
  using (employee_id = public.current_employee_id()
      or public.current_employee_role() in ('ceo', 'admin', 'accounting_manager'));

drop policy if exists "balances_own" on leave_balances;
create policy "balances_own" on leave_balances for select
  using (employee_id = public.current_employee_id()
      or public.current_employee_role() in ('ceo', 'admin', 'accounting_manager'));

drop policy if exists "salaries_self_or_manager" on employee_salaries;
create policy "salaries_self_or_manager" on employee_salaries for select
  using (employee_id = public.current_employee_id()
      or public.current_employee_role() in ('accounting_manager', 'ceo', 'admin'));

drop policy if exists "expenses_self_or_manager" on expenses;
create policy "expenses_self_or_manager" on expenses for all
  using (employee_id = public.current_employee_id()
      or public.current_employee_role() in ('accounting_manager', 'ceo', 'admin'));

-- ── 4. Scope the reference-table read policies to authenticated only ───
drop policy if exists "mileage_rates_read_all_authenticated" on mileage_rates;
create policy "mileage_rates_read_all_authenticated" on mileage_rates for select
  to authenticated using (true);

drop policy if exists "grants_read_all_authenticated" on grants;
create policy "grants_read_all_authenticated" on grants for select
  to authenticated using (true);
