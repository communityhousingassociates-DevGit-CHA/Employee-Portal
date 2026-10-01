-- CHA Employee Portal — Migration 038: audit trail for expenses
--
-- `expense_events` is an append-only log of what happens to an expense: submitted by the employee, entered on their behalf by a
-- named administrator (with the reason code and notes), approved, or denied (with the reason). The actor's name and role are
-- snapshotted on the row so the record stays readable even if the employee record later changes. Matches leave_request_events.
--
-- Existing expenses are backfilled from what the expense row already knows (`backfilled`).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists expense_events (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  action text not null check (action in ('submitted', 'submitted_on_behalf', 'approved', 'denied')),
  actor_id uuid references employees(id),
  actor_name text,
  actor_role text,
  reason_code text,
  note text,
  backfilled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists expense_events_expense_idx on expense_events (expense_id, created_at);
create index if not exists expense_events_actor_idx on expense_events (actor_id, created_at desc);

alter table expense_events enable row level security;

-- Defense-in-depth only — the app reads/writes exclusively through the service-role client (see migrations 004/012).
create policy "expense_events_managers_read" on expense_events for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));

-- Append-only: history rows can be added, never edited.
create or replace function expense_events_no_update() returns trigger language plpgsql as $$
begin
  raise exception 'expense_events is append-only';
end;
$$;

drop trigger if exists expense_events_no_update on expense_events;
create trigger expense_events_no_update before update on expense_events
  for each row execute function expense_events_no_update();

-- Backfill (only once: skipped if any events already exist).
do $$
begin
  if exists (select 1 from expense_events) then return; end if;

  -- Submitted: by the employee, or on their behalf when a submitter is recorded.
  insert into expense_events (expense_id, action, actor_id, actor_name, actor_role, reason_code, note, created_at, backfilled)
  select x.id,
         case when x.submitted_by is not null then 'submitted_on_behalf' else 'submitted' end,
         coalesce(x.submitted_by, x.employee_id),
         coalesce(s.name, e.name), coalesce(s.role, e.role),
         x.on_behalf_reason_code, x.on_behalf_note, x.created_at, true
  from expenses x
  join employees e on e.id = x.employee_id
  left join employees s on s.id = x.submitted_by;

  -- Decided: approved or denied by the recorded approver.
  insert into expense_events (expense_id, action, actor_id, actor_name, actor_role, note, created_at, backfilled)
  select x.id, x.status, x.approver_id, m.name, m.role,
         case when x.status = 'denied' then x.deny_reason end, coalesce(x.approved_at, x.created_at), true
  from expenses x join employees m on m.id = x.approver_id
  where x.status in ('approved', 'denied');
end $$;
