-- CHA Employee Portal — Migration 032: who granted a travel-access override (audit trail for the sign-in location rule).
alter table employees add column if not exists geofence_override_by uuid references employees(id) on delete set null;
