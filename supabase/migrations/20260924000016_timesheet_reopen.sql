-- CHA Employee Portal — Migration 016: timesheet reopen history + employee correction requests
--
--   * `timesheet_events` — append-only log of who did what to a timesheet and why (submit, return,
--     approve, reopen, CEO override, employee correction request, leave-driven reopen/hold), with a
--     reason code and notes. This is the audit trail behind the "firm but flexible" locking policy.
--   * `timesheets.correction_requested_at` / `correction_note` — an employee's in-portal request to
--     reopen a submitted/approved timesheet, cleared when an approver acts on it.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists timesheet_events (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references timesheets(id) on delete cascade,
  actor_id uuid references employees(id),
  action text not null check (action in (
    'submitted', 'approved', 'returned', 'reopened', 'override_reopened',
    'correction_requested', 'leave_reopened', 'leave_held'
  )),
  reason_code text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists timesheet_events_timesheet_idx on timesheet_events (timesheet_id, created_at desc);

alter table timesheet_events enable row level security;

-- Defense-in-depth only — the app reads/writes exclusively through the service-role client (see migrations 004/012).
create policy "timesheet_events_managers_read" on timesheet_events for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

alter table timesheets add column if not exists correction_requested_at timestamptz;
alter table timesheets add column if not exists correction_note text;

-- Holiday Hours: scheduled holidays are recorded separately from Regular and Leave hours (for tracking).
-- System-filled when a timesheet is created — not editable by the employee.
alter table timesheet_rows add column if not exists holiday_hours numeric not null default 0;
