-- CHA Employee Portal — Migration 023: every balance load records the date its numbers are AS OF
--
-- A balance file is only meaningful with the date it describes; without it two loads can't be ordered and
-- accruals can't be started at the right period. The Data Import tool now requires a "balances as of" date, stores
-- it on the batch, and writes an audit row for every balance it loads (same table as the Leave Balances overrides).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table import_batches add column if not exists balances_as_of date;
