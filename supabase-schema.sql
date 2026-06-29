-- CHA Employee Portal — Supabase Schema
-- Run this in the Supabase SQL editor after creating the project

-- Employees
create table employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text not null unique,
  role text not null default 'employee', -- employee | accounting_manager | ceo | admin
  employee_type text not null default 'full-time', -- full-time | part-time | consultant
  hire_date date not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Leave balances (one row per employee, updated on each accrual event)
create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  pto_hours numeric not null default 0,
  sick_hours numeric not null default 0,
  personal_hours numeric not null default 0,
  updated_at timestamptz default now()
);

-- Leave requests
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  leave_type text not null, -- PTO | Sick | Personal | Bereavement | Jury Duty
  start_date date not null,
  end_date date not null,
  hours numeric not null,
  note text,
  status text not null default 'pending', -- pending | approved | denied
  approver_id uuid references employees(id),
  approved_at timestamptz,
  employee_signed_at timestamptz,
  approver_signed_at timestamptz,
  created_at timestamptz default now()
);

-- Timesheets (one per employee per pay period)
create table timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft', -- draft | submitted | approved
  employee_signed_at timestamptz,
  approver_id uuid references employees(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  unique(employee_id, period_start)
);

-- Timesheet rows (one per work day)
create table timesheet_rows (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid references timesheets(id) not null,
  work_date date not null,
  description text,
  regular_hours numeric not null default 0,
  leave_hours numeric not null default 0,
  leave_type text
);

-- Accrual log (audit trail of every accrual event)
create table accrual_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) not null,
  accrual_type text not null, -- pto | sick
  hours numeric not null,
  period_start date not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table employees enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table timesheets enable row level security;
alter table timesheet_rows enable row level security;

-- Employees can only see their own records; CEO/admin can see all
create policy "employees_own" on leave_requests for all
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('ceo', 'admin')));

create policy "balances_own" on leave_balances for select
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('ceo', 'admin', 'accounting_manager')));

create policy "timesheets_own" on timesheets for all
  using (employee_id = (select id from employees where user_id = auth.uid())
      or exists (select 1 from employees where user_id = auth.uid() and role in ('ceo', 'admin')));
