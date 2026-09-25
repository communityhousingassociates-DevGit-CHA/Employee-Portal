-- CHA Employee Portal — Migration 027: per-day hours on a leave request
--
-- A leave request can now cover several days (e.g. a full week off) with its own hours on each — 8 on Monday, 4 on
-- Tuesday morning — and is still approved, denied, or cancelled as one request. The request keeps start_date / end_date /
-- hours (earliest day, latest day, total) so everything that already reads those keeps working; this table holds the
-- day-by-day detail. Requests created before this migration have no rows here; the app falls back to spreading their
-- hours across the workdays in their range, exactly as before.

create table if not exists leave_request_days (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references leave_requests(id) on delete cascade,
  work_date date not null,
  hours numeric not null check (hours > 0 and hours <= 8),
  unique (request_id, work_date)
);

create index if not exists leave_request_days_request_idx on leave_request_days (request_id);
create index if not exists leave_request_days_date_idx on leave_request_days (work_date);

alter table leave_request_days enable row level security;
create policy "leave_request_days_read" on leave_request_days for select to authenticated
  using (
    exists (
      select 1 from leave_requests r
      where r.id = leave_request_days.request_id
        and (r.employee_id = public.current_employee_id() or public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'))
    )
  );
