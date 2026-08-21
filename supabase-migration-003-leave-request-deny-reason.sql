-- CHA Employee Portal — Migration 003: leave request deny reason
-- `note` is the employee's own note on the request; the approver's denial
-- reason needs its own column so approving/denying doesn't clobber it.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

alter table leave_requests
  add column if not exists deny_reason text;
