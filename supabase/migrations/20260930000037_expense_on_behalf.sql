-- CHA Employee Portal — Migration 037: expenses submitted on an employee's behalf
--
-- Same exception as leave requests and timesheets (migration 036): a named administrator (the President/CEO, the Accounting
-- Manager, or the system super admin) may enter an expense for another employee. `submitted_by` records who, and the reason
-- code and notes record why; a NULL `submitted_by` means the employee entered it themselves. Expenses have no event log, so
-- these columns, `created_at`, and the approver columns are the record.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table expenses add column if not exists submitted_by uuid references employees(id);
alter table expenses add column if not exists on_behalf_reason_code text;
alter table expenses add column if not exists on_behalf_note text;
