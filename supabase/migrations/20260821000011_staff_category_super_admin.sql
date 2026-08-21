-- CHA Employee Portal — Migration 011: staff category + super admin flag
--
-- staff_category distinguishes CHA employees from Resident Advocates, whose
-- real timesheet/mileage process differs materially (grant % allocation,
-- 7-day week) — not yet built, but the roster needs to carry the
-- distinction now so it's ready when that feature lands. Separate from
-- employee_type (full-time/part-time/consultant), which is orthogonal.
--
-- is_super_admin gates the two truly destructive import actions
-- (commitImport, inviteEmployees) behind a narrower check than the general
-- 'admin' role — maker-checker: whoever prepares an import (role: admin)
-- isn't necessarily who's allowed to commit it.
--
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

alter table employees add column if not exists staff_category text not null default 'cha_employee'
  check (staff_category in ('cha_employee', 'resident_advocate'));

alter table employees add column if not exists is_super_admin boolean not null default false;
