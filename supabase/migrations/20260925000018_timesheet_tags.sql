-- CHA Employee Portal — Migration 018: hand-picked timesheet tags with a managed tag list
--
--   * `timesheet_tags` — the managed list (name, color, description, optional payroll/Sage code, active flag).
--     Managed by payroll-access users (Nico, Carrileen, super admin); tags are deactivated, never deleted,
--     so history stays readable.
--   * `timesheet_rows.tag_ids` — the tags applied to a day. Employees tag their own days while a timesheet is
--     a draft; approvers may adjust during review (logged as a 'tags_changed' event). Label-only for now —
--     tags mark a day, they don't split its hours.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

create table if not exists timesheet_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'teal',
  description text,
  code text,
  is_active boolean not null default true,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create unique index if not exists timesheet_tags_name_uniq on timesheet_tags (lower(btrim(name)));

alter table timesheet_tags enable row level security;

-- The tag list is not sensitive (names/colors only); any signed-in user may read it. Writes go through the app's
-- service-role client, which enforces who may manage tags.
create policy "timesheet_tags_read" on timesheet_tags for select to authenticated using (true);

alter table timesheet_rows add column if not exists tag_ids uuid[] not null default '{}';
create index if not exists timesheet_rows_tag_ids_idx on timesheet_rows using gin (tag_ids);

alter table timesheet_events drop constraint if exists timesheet_events_action_check;
alter table timesheet_events add constraint timesheet_events_action_check check (action in (
  'submitted', 'approved', 'returned', 'reopened', 'override_reopened',
  'correction_requested', 'leave_reopened', 'leave_held', 'tags_changed'
));
