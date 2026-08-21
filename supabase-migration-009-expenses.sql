-- CHA Employee Portal — Migration 009: unified mileage + travel expenses
-- Mileage and general travel expenses (hotel/airline/meals/entertainment)
-- share one table: identical approval workflow, both need receipts,
-- reporting is naturally one query. Mileage-only fields (miles,
-- rate_per_mile) are simply nullable for other categories.
-- Apply via `supabase db push` (CLI) or `psql`, not the browser SQL editor.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  category text not null, -- mileage | hotel | airline | meals | entertainment | other
  expense_date date not null,
  description text,
  miles numeric,               -- only populated for category = 'mileage'
  rate_per_mile numeric,       -- snapshot at submission time — later rate changes don't retroactively alter history
  amount numeric not null,     -- for mileage, computed server-side (miles * rate); never trust a client-supplied amount
  receipt_url text,            -- path in the private 'receipts' bucket
  grant_id uuid references grants(id),
  status text not null default 'pending', -- pending | approved | denied
  approver_id uuid references employees(id),
  approved_at timestamptz,
  deny_reason text,
  created_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "expenses_self_or_manager" on expenses for all
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('accounting_manager','ceo','admin')));

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;
