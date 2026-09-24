-- CHA Employee Portal — Migration 017: accounting "close period"
--
-- Accounting closes out a range of dates (picked from a calendar) once time for it is final. While a range
-- is closed: no new leave requests for those dates, timesheets touching them can't be edited or submitted
-- (unless deliberately reopened), and reopening an approved timesheet needs the CEO override. Lifting a
-- closure is CEO-only and requires a note; lifted rows are kept as history (lifted_at is set, never deleted).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists closed_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  note text,
  closed_by uuid references employees(id),
  closed_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references employees(id),
  lift_note text
);

create index if not exists closed_periods_active_idx on closed_periods (start_date, end_date) where lifted_at is null;

alter table closed_periods enable row level security;

-- Defense-in-depth only — the app reads/writes exclusively through the service-role client (see migrations 004/012).
create policy "closed_periods_managers_read" on closed_periods for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));
