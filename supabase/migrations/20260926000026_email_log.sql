-- CHA Employee Portal — Migration 026: log of every email the portal sends
--
-- Notification and issue-report emails are best-effort (a failed send never fails the action that triggered it), which
-- also means a failure was invisible. Each send now records its outcome — recipient, subject, Resend message id, and any
-- error — so "did the alert go out?" can be answered from the database.

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,                       -- 'notification' | 'issue_report'
  kind text,                                  -- notification kind (approval_needed, approved, ...)
  recipient_email text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  resend_id text,
  error text
);

create index if not exists email_log_created_idx on email_log (created_at desc);
create index if not exists email_log_recipient_idx on email_log (recipient_email, created_at desc);

alter table email_log enable row level security;
create policy "email_log_managers_read" on email_log for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));
