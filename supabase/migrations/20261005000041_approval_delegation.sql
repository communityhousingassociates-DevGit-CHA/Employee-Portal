-- CHA Employee Portal — Migration 041: backup approver (delegation)
--
-- Policy (2026-10-05): the CEO (Nico Sanders) alone makes the final approve/deny decision on leave requests, expenses and
-- timesheets. He may name a backup — e.g. the Accounting Manager — for a date range while he's unavailable. A backup
-- decides only inside that window, never her own items or the CEO's. Decisions made under a delegation record whose
-- authority they used (`delegated_from`) so the audit trail reads "approved on behalf of Nico".
--
-- Service-role access only (RLS on, no policies), like every other table the app reads through Server Actions.

create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  delegator_id uuid not null references public.employees(id),
  delegate_id uuid not null references public.employees(id),
  starts_on date not null,
  ends_on date not null,
  note text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint approval_delegations_dates check (ends_on >= starts_on),
  constraint approval_delegations_distinct check (delegator_id <> delegate_id)
);

create index if not exists approval_delegations_active_idx
  on public.approval_delegations (delegate_id, starts_on, ends_on) where revoked_at is null;

alter table public.approval_delegations enable row level security;

alter table public.leave_requests add column if not exists delegated_from uuid references public.employees(id);
alter table public.expenses       add column if not exists delegated_from uuid references public.employees(id);
alter table public.timesheets     add column if not exists delegated_from uuid references public.employees(id);
