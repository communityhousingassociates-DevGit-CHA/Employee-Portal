-- CHA Employee Portal — Migration 033: audit trail for leave requests
--
-- `leave_request_events` is an append-only log of everything that happens to a leave request: submitted, auto-approved
-- (balance covered it), approved / denied by a named manager, and cancelled by the employee. The manager's name and role
-- are snapshotted on the row so the record stays readable even if the employee record later changes.
-- `leave_requests.approver_id` / `approved_at` still hold the latest decision for quick display; this table is the history.
--
-- Existing requests are backfilled from what the request row already knows (see `backfilled`). Cancellation times were
-- never recorded before now, so backfilled cancellations carry the request's creation time.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists leave_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references leave_requests(id) on delete cascade,
  action text not null check (action in ('submitted', 'auto_approved', 'approved', 'denied', 'cancelled')),
  actor_id uuid references employees(id),
  actor_name text,
  actor_role text,
  note text,
  backfilled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists leave_request_events_request_idx on leave_request_events (request_id, created_at);
create index if not exists leave_request_events_actor_idx on leave_request_events (actor_id, created_at desc);

alter table leave_request_events enable row level security;

-- Defense-in-depth only — the app reads/writes exclusively through the service-role client (see migrations 004/012).
create policy "leave_request_events_managers_read" on leave_request_events for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

-- Append-only: history rows can be added, never edited.
create or replace function leave_request_events_no_update() returns trigger language plpgsql as $$
begin
  raise exception 'leave_request_events is append-only';
end;
$$;

drop trigger if exists leave_request_events_no_update on leave_request_events;
create trigger leave_request_events_no_update before update on leave_request_events
  for each row execute function leave_request_events_no_update();

-- Backfill (only once: skipped if any events already exist).
do $$
begin
  if exists (select 1 from leave_request_events) then return; end if;

  insert into leave_request_events (request_id, action, actor_id, actor_name, actor_role, created_at, backfilled)
  select r.id, 'submitted', r.employee_id, e.name, e.role, coalesce(r.employee_signed_at, r.created_at), true
  from leave_requests r join employees e on e.id = r.employee_id;

  insert into leave_request_events (request_id, action, actor_id, actor_name, actor_role, created_at, backfilled)
  select r.id, 'auto_approved', null, 'System (balance covered the request)', null, coalesce(r.approved_at, r.created_at), true
  from leave_requests r where r.status in ('approved', 'cancelled') and r.approver_id is null and r.approved_at is not null;

  insert into leave_request_events (request_id, action, actor_id, actor_name, actor_role, note, created_at, backfilled)
  select r.id, case when r.status = 'denied' then 'denied' else 'approved' end, r.approver_id, m.name, m.role,
         case when r.status = 'denied' then r.deny_reason end, coalesce(r.approved_at, r.created_at), true
  from leave_requests r join employees m on m.id = r.approver_id
  where r.approver_id is not null and r.status in ('approved', 'denied', 'cancelled');

  insert into leave_request_events (request_id, action, actor_id, actor_name, actor_role, note, created_at, backfilled)
  select r.id, 'cancelled', r.employee_id, e.name, e.role, r.deny_reason, r.created_at, true
  from leave_requests r join employees e on e.id = r.employee_id where r.status = 'cancelled';
end $$;
