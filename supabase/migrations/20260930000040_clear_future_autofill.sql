-- CHA Employee Portal — Migration 040: stop auto-populating hours on days that haven't arrived
--
-- Timesheets used to fill 8 regular hours (and holiday hours) on every workday of a period, including days still in the
-- future. Policy (2026-10-01): populate only up to the current date (Eastern Time). This clears the auto-filled hours on
-- future days of DRAFT timesheets so they match. Approved leave on a future day (leave_hours > 0) is left alone, and
-- submitted/approved timesheets are never touched. Safe to re-run; the app now fills each day in as it arrives.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

update timesheet_rows r
set regular_hours = 0, holiday_hours = 0
from timesheets t
where t.id = r.timesheet_id
  and t.status = 'draft'
  and r.work_date > (now() at time zone 'America/New_York')::date
  and r.leave_hours = 0
  and (r.regular_hours <> 0 or r.holiday_hours <> 0);
