-- CHA Employee Portal — Migration 018: dismissible timesheet reminder
-- Replaces the forced full-width Dashboard banner with a small topbar alert
-- button (mirrors IssueAlertBell) that any employee can click off without
-- being routed to /timesheet. Dismissal is per-day: comparing dismissed_at's
-- calendar date against today means a dismissal on the "2 days out" day
-- doesn't suppress the "1 day out" reminder the next day — each day gets a
-- fresh chance to show, no per-due-date tracking needed.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table employees add column if not exists timesheet_reminder_dismissed_at timestamptz;
