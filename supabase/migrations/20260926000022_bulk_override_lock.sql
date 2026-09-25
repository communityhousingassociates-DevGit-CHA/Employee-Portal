-- CHA Employee Portal — Migration 022: lock bulk balance overrides once balances are validated
--
-- After the initial load and validation, balances should rarely change and never in bulk. This adds a lock to the
-- single settings row: while locked, the file-based bulk override is refused (single-employee adjustments with a
-- reason remain available). Locking is one click; unlocking needs a written reason and is recorded.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table accrual_settings add column if not exists bulk_override_locked boolean not null default false;
alter table accrual_settings add column if not exists bulk_override_locked_at timestamptz;
alter table accrual_settings add column if not exists bulk_override_locked_by uuid references employees(id);
alter table accrual_settings add column if not exists bulk_override_unlock_reason text;
