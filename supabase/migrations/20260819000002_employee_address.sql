-- CHA Employee Portal — Migration 002: employee address fields
-- Adds mailing address columns to `employees`, sourced from the Phase 2
-- Employee Information Intake spreadsheet. Run after supabase-schema.sql.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

alter table employees
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text;
