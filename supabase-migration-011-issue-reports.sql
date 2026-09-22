-- CHA Employee Portal — Migration 011: issue reports (in-app "Report an Issue")
-- Employee-submitted tickets, visible to Accounting Manager/CEO/Admin in-app —
-- complements, not replaces, the email notification sent at submission time.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  category text not null, -- login | pay_balance | timesheet | leave_request | expense | other
  description text not null,
  page_url text,
  status text not null default 'open', -- open | reviewed
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table issue_reports enable row level security;
create policy "issue_reports_self_or_manager" on issue_reports for all
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('accounting_manager','ceo','admin')));

-- Per-admin "last seen" watermark, drives the animated alert bell (dismiss = bump this).
alter table employees add column if not exists issues_seen_at timestamptz;
