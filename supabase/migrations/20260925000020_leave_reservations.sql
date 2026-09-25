-- CHA Employee Portal — Migration 020: reserve future leave, deduct on the leave date
--
-- Approved leave whose start date is still in the future is now RESERVED against the employee's projected balance
-- instead of being deducted immediately: the hours come off the balance when the leave begins (a daily job applies
-- them). `balance_deducted_at` records when that happened; NULL on an approved balance-drawing request means
-- "reserved, not yet deducted".
--
-- Existing approved PTO / Sick / Vacation requests were deducted at approval time under the old rule, so they are
-- marked deducted now (at their approval time) and behave exactly as before.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table leave_requests add column if not exists balance_deducted_at timestamptz;

update leave_requests
set balance_deducted_at = coalesce(approved_at, now())
where status = 'approved'
  and leave_type in ('PTO', 'Sick', 'Personal')
  and balance_deducted_at is null;

create index if not exists leave_requests_reserved_idx on leave_requests (start_date)
  where status = 'approved' and balance_deducted_at is null;
