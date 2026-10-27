-- CHA Employee Portal — Migration 043: audit trail for manual timesheet edits
--
-- Nico, Carrileen and the super admin can open any employee's timesheet read-only and press "Override / Edit" to change it by hand.
-- Every save is logged as one 'manual_edit' event with the reason code and notes they gave, plus the exact before/after of each
-- field that changed (`changes`: [{ date, field, from, to }]). Applies to drafts as well as submitted/approved timesheets.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table timesheet_events add column if not exists changes jsonb;

alter table timesheet_events drop constraint if exists timesheet_events_action_check;
alter table timesheet_events add constraint timesheet_events_action_check
  check (action in ('submitted', 'submitted_on_behalf', 'edited_on_behalf', 'manual_edit', 'approved', 'returned', 'reopened', 'override_reopened',
                    'correction_requested', 'leave_reopened', 'leave_held', 'tags_changed'));
