-- CHA Employee Portal — Migration 013: admin notes on fixed issue reports
-- Free-text note an admin leaves when marking a ticket fixed (what was done to
-- remediate it) — shown alongside fixed_at in the Issue Reports admin view.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table issue_reports add column if not exists fix_notes text;
