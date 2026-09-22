-- CHA Employee Portal — Migration 015: per-employee PTO cap exception
-- The 400-hour PTO carryover cap remains the standard policy; this flag lets
-- an admin exempt a specific employee (e.g. an executive exception) from it.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table employees add column if not exists pto_uncapped boolean not null default false;
