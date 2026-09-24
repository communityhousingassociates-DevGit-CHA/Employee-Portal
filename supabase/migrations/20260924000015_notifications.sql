-- CHA Employee Portal — Migration 015: in-portal notifications + timesheet returns
--
-- Backs the approval-notification workflow:
--   * `notifications` — one row per in-portal notice (an approver has something
--     to review, or an employee's leave/expense/timesheet was decided). The
--     matching email is sent separately by the app; this row is the durable,
--     dismissible in-portal copy shown in the topbar bell.
--   * `timesheets.return_reason` — when an approver sends a timesheet back for
--     correction, the status returns to 'draft' and this holds their reason so
--     the employee can see what to fix before resubmitting.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  kind text not null check (kind in ('approval_needed', 'approved', 'denied', 'returned')),
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_employee_created_idx on notifications (employee_id, created_at desc);

alter table notifications enable row level security;

-- Defense-in-depth only — the app reads/writes exclusively through the
-- service-role client (see migrations 004/012). An employee can only ever
-- see their own notices, and never via the anon role.
create policy "notifications_select_own" on notifications for select to authenticated
  using (employee_id = public.current_employee_id());

alter table timesheets add column if not exists return_reason text;
