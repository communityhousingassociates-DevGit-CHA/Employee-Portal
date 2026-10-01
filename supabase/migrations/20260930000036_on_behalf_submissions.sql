-- CHA Employee Portal — Migration 036: submitting leave requests and timesheets on an employee's behalf
--
-- An admin (admin / CEO / accounting manager) may complete another employee's leave request or timesheet as an EXCEPTION to
-- the employee submitting directly. Every such submission records who did it (`submitted_by`) and why (a reason code plus
-- notes), and writes its own audit event. A NULL `submitted_by` means the employee submitted it themselves.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table leave_requests add column if not exists submitted_by uuid references employees(id);
alter table leave_requests add column if not exists on_behalf_reason_code text;
alter table leave_requests add column if not exists on_behalf_note text;

alter table timesheets add column if not exists submitted_by uuid references employees(id);
alter table timesheets add column if not exists on_behalf_reason_code text;
alter table timesheets add column if not exists on_behalf_note text;

-- Leave audit trail: a new event type and the reason code that goes with it.
alter table leave_request_events add column if not exists reason_code text;
alter table leave_request_events drop constraint if exists leave_request_events_action_check;
alter table leave_request_events add constraint leave_request_events_action_check
  check (action in ('submitted', 'submitted_on_behalf', 'auto_approved', 'approved', 'denied', 'cancelled'));

-- Timesheet audit trail (already has reason_code + note): an admin submitting for the employee, and editing their draft.
alter table timesheet_events drop constraint if exists timesheet_events_action_check;
alter table timesheet_events add constraint timesheet_events_action_check
  check (action in ('submitted', 'submitted_on_behalf', 'edited_on_behalf', 'approved', 'returned', 'reopened', 'override_reopened',
                    'correction_requested', 'leave_reopened', 'leave_held', 'tags_changed'));

-- The employee is told when someone completed something for them.
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('approval_needed', 'approved', 'denied', 'returned', 'cancelled', 'on_behalf'));
