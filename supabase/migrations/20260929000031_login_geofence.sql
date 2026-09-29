-- CHA Employee Portal — Migration 031: sign-in geofence for selected users
--
--   * employees.login_geofence_regions  Per-person exception to the portal-wide location rule (portal_settings.values: geofence_enabled,
--                                       geofence_regions). NULL = follow the portal-wide rule; {'*'} = allowed from anywhere; or a
--                                       list of state codes for this person only. Checked by the middleware using Vercel's IP geolocation.
--   * employees.geofence_override_until Temporary "travel access": until this time the person may sign in from anywhere.
--   * geofence_blocks                   Every request the geofence refused, for review (and the daily problems email).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table employees add column if not exists login_geofence_regions text[];
alter table employees add column if not exists geofence_override_until timestamptz;

create table if not exists geofence_blocks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  country text,
  region text,
  city text,
  ip text,
  path text,
  created_at timestamptz not null default now()
);
create index if not exists geofence_blocks_created_idx on geofence_blocks (created_at desc);
alter table geofence_blocks enable row level security; -- no policies: only the service role (server) reads or writes it
