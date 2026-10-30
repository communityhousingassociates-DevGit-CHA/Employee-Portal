-- Payroll access (salary amounts, other people's timesheets, submit-on-behalf) used to be a list of email addresses in code
-- (lib/constants/salary-access.ts). Changing someone's login meant editing code and redeploying. It is now a flag on the employee,
-- changed only by a super admin through the setPayrollAccess action, with every change recorded in payroll_access_audit.
--
-- APPLY THIS BEFORE DEPLOYING the code that reads it: User Management and the account-management guards select the column by name.
-- The access check itself (hasPayrollAccess) tolerates the column being absent and falls back to the old email list, so reads of the
-- whole employee row keep working either way. Super admins keep payroll access through is_super_admin regardless of this flag.
alter table employees add column if not exists has_payroll_access boolean not null default false;

-- Carry over exactly who has access today (the three addresses that were in PAYROLL_ACCESS_EMAILS).
update employees
   set has_payroll_access = true
 where lower(email) in ('cedwards@communityhousingmd.org', 'nsanders@communityhousingmd.org', 'johnnyrio22@gmail.com');

create table if not exists payroll_access_audit (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  changed_by uuid references employees(id) on delete set null,
  enabled boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists payroll_access_audit_employee_idx on payroll_access_audit (employee_id, created_at desc);

-- Same posture as every other table: server code only. (Default privileges already withhold client access to new tables.)
alter table payroll_access_audit enable row level security;
