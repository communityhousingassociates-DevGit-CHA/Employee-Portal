-- CHA Employee Portal — Migration 030: persisted Portal Settings
--
-- The Admin → Portal Settings "leave policy" numbers (PTO accrual tiers, sick rate, Personal Days grant, year-end carryover
-- caps, waiting periods, approval-reminder days) are stored here and read by the accrual engine, carryover job, Personal Days
-- grant, leave validation, projections, and the approver digest. Missing keys fall back to the SOP defaults in lib/policy.ts.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists portal_settings (
  id boolean primary key default true check (id), -- single row
  values jsonb not null default '{}'::jsonb,
  updated_by uuid references employees(id),
  updated_at timestamptz not null default now()
);
insert into portal_settings (id) values (true) on conflict do nothing;

alter table portal_settings enable row level security;
create policy "portal_settings_managers_read" on portal_settings for select to authenticated
  using (public.current_employee_role() in ('admin', 'ceo', 'accounting_manager'));
