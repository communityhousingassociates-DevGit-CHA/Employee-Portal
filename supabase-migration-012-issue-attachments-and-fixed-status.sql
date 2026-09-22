-- CHA Employee Portal — Migration 012: issue screenshots + a "fixed" status
-- Adds an optional screenshot/file attachment to Report an Issue submissions,
-- and a third ticket status (open -> reviewed -> fixed) so admins can mark
-- something as actually remediated, not just acknowledged.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table issue_reports add column if not exists attachment_url text; -- path in the private 'issue-attachments' bucket
alter table issue_reports add column if not exists fixed_by uuid references employees(id);
alter table issue_reports add column if not exists fixed_at timestamptz;
-- status remains free text (open | reviewed | fixed), same convention as expenses.status — no CHECK constraint.

insert into storage.buckets (id, name, public)
values ('issue-attachments', 'issue-attachments', false)
on conflict (id) do nothing;
