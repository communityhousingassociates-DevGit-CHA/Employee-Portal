-- CHA Employee Portal — Migration 017: login attempt lockout (brute-force cap)
-- Creates the login_attempts table and hook_password_verification_attempt()
-- function to back Supabase's native "Password Verification Attempt" auth
-- hook — confirmed unavailable on this project's plan tier ("cannot be
-- configured for this organization" via the Management API), so it's NOT
-- wired up as a live GoTrue hook. Enforcement is instead driven from the app
-- (src/app/actions/auth.ts: checkLoginAllowed/recordFailedLogin), reusing this
-- same table and the identical threshold logic, tested directly via SQL
-- before being wired in. The unused hook_password_verification_attempt()
-- function is left in place in case this org's plan changes later.
-- Fails OPEN by design: any unexpected error, missing row, or null falls
-- through to `continue`/allowed — a bug here must never lock out the whole
-- company. Threshold is deliberately generous (10 failed attempts / 15 min
-- -> 15 min lockout) so genuine typos during rollout don't trip it; this is
-- a brute-force deterrent, not a hair-trigger.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

create table if not exists login_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table login_attempts enable row level security;
-- No public policies — only the auth hook (via supabase_auth_admin, which
-- bypasses RLS as the table owner) and the service-role admin client touch this.

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_valid boolean;
  v_failed_count int;
  v_locked_until timestamptz;
  v_updated_at timestamptz;
  v_max_attempts int := 10;
  v_lockout_minutes int := 15;
  v_window_minutes int := 15;
begin
  begin
    v_user_id := (event->>'user_id')::uuid;
    v_valid := (event->>'valid')::boolean;

    if v_user_id is null then
      return jsonb_build_object('decision', 'continue');
    end if;

    insert into public.login_attempts (user_id) values (v_user_id)
    on conflict (user_id) do nothing;

    select failed_count, locked_until, updated_at into v_failed_count, v_locked_until, v_updated_at
    from public.login_attempts where user_id = v_user_id for update;

    -- Currently locked out and still within the window: reject regardless
    -- of whether this particular attempt's password was correct.
    if v_locked_until is not null and v_locked_until > now() then
      return jsonb_build_object('decision', 'reject', 'message', 'Too many failed attempts. Try again in a few minutes, or ask an admin to reset your password.');
    end if;

    if v_valid then
      update public.login_attempts set failed_count = 0, locked_until = null, updated_at = now()
      where user_id = v_user_id;
      return jsonb_build_object('decision', 'continue');
    end if;

    -- A failure outside any prior lockout window resets the counter to 1
    -- rather than compounding indefinitely across unrelated days.
    if v_locked_until is null and v_updated_at is not null and now() - v_updated_at > (v_window_minutes || ' minutes')::interval then
      v_failed_count := 0;
    end if;

    v_failed_count := coalesce(v_failed_count, 0) + 1;

    update public.login_attempts
    set failed_count = v_failed_count,
        locked_until = case when v_failed_count >= v_max_attempts then now() + (v_lockout_minutes || ' minutes')::interval else null end,
        updated_at = now()
    where user_id = v_user_id;

    return jsonb_build_object('decision', 'continue');
  exception when others then
    -- Fail open: never let a bug in this function block a real login.
    return jsonb_build_object('decision', 'continue');
  end;
end;
$$;

grant execute on function public.hook_password_verification_attempt to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt from authenticated, anon, public;
