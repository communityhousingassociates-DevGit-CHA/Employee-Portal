-- CHA Employee Portal — Migration 016: exclude dev/test accounts from reports
-- "Test User" and the super-admin dev account are used to exercise features
-- but aren't real CHA staff — they shouldn't appear in aggregated Reports or
-- timesheet roll-ups sent out as real payroll data.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table employees add column if not exists is_test_account boolean not null default false;

update employees set is_test_account = true
where email in ('advisor@globalist.pro', 'johnnyrio22@gmail.com');
