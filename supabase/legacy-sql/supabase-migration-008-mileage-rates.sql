-- CHA Employee Portal — Migration 008: mileage rate, versioned by year
-- Admin/accounting_manager-editable so the IRS standard mileage rate can be
-- updated each January 1st without a code deploy. Expense submission must
-- hard-error if no row exists for the entry's year, rather than silently
-- defaulting to $0 or a stale rate.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

create table if not exists mileage_rates (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  rate_per_mile numeric not null,
  updated_at timestamptz default now(),
  updated_by uuid references employees(id)
);

-- Placeholder using the last confirmed IRS standard business rate ($0.70/mi
-- for 2025) — CONFIRM the actual 2026 rate with CHA/finance via the
-- /mileage-rate page before this is relied on for real reimbursements.
insert into mileage_rates (year, rate_per_mile)
values (2026, 0.70)
on conflict (year) do nothing;

alter table mileage_rates enable row level security;
create policy "mileage_rates_read_all_authenticated" on mileage_rates for select using (true);
