-- CHA Employee Portal — Migration 019: employee end/termination date
-- Optional, not yet required — set on separation. Nullable, no default.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table employees add column if not exists end_date date;
