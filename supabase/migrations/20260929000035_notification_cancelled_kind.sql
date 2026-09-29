-- CHA Employee Portal — Migration 035: 'cancelled' notification kind
--
-- Approvers (accounting manager / CEO / admin) are now told, in the portal bell and by email, when an employee cancels
-- a leave request. Allow that kind on `notifications`.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('approval_needed', 'approved', 'denied', 'returned', 'cancelled'));
