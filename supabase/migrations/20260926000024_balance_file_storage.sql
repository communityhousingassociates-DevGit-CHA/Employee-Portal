-- CHA Employee Portal — Migration 024: keep a copy of every balance file that is loaded
--
-- The 9/18 load taught us that parsing a workbook and discarding it loses the evidence (its As Of Date, exactly what
-- was sent). Balance files are now saved to a private storage bucket and linked from the load's audit record, so
-- the original can always be retrieved. Only the payroll-access group can fetch them (via a short-lived signed link).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

insert into storage.buckets (id, name, public)
values ('balance-files', 'balance-files', false)
on conflict (id) do nothing;

alter table import_batches add column if not exists balance_file_path text;
alter table balance_adjustments add column if not exists source_file_path text;
