-- Supports forcing a password change after an admin sets a temporary
-- password directly (rather than emailing a self-service reset link).
-- login_count increments once per successful sign-in (see
-- src/app/actions/auth.ts); when force_password_change is true and
-- login_count reaches 3, middleware redirects every request to
-- /change-password until the employee sets their own password.
alter table employees
  add column if not exists login_count integer not null default 0,
  add column if not exists force_password_change boolean not null default false;
