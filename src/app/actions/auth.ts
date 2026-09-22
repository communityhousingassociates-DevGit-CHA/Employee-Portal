'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_ATTEMPTS = 10
const WINDOW_MINUTES = 15
const LOCKOUT_MINUTES = 15

/**
 * Brute-force cap on login attempts, driven from the app rather than
 * Supabase's native "Password Verification Attempt" hook — that hook isn't
 * available on this project's plan tier (confirmed via the Management API:
 * "cannot be configured for this organization"). Same login_attempts table
 * and threshold the hook version was built and tested against.
 *
 * Fails OPEN on any error — a bug here must never lock out real logins, so
 * every catch returns allowed:true rather than blocking. This intentionally
 * makes the cap a best-effort deterrent, not a hard guarantee: a login this
 * function fails to check still reaches Supabase's own signInWithPassword,
 * which is the actual credential check either way.
 */
export async function checkLoginAllowed(email: string): Promise<{ allowed: boolean; message?: string }> {
  try {
    const admin = createAdminClient()
    const { data: employee } = await admin.from('employees').select('user_id').eq('email', email).maybeSingle()
    if (!employee?.user_id) return { allowed: true } // unknown email — let Supabase's own "invalid credentials" handle it

    const { data: attempt } = await admin.from('login_attempts').select('locked_until').eq('user_id', employee.user_id).maybeSingle()
    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
      return { allowed: false, message: 'Too many failed attempts. Try again in a few minutes, or ask an admin to reset your password.' }
    }
    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

/** Called after Supabase rejects a sign-in attempt with valid credentials format but wrong password. */
export async function recordFailedLogin(email: string) {
  try {
    const admin = createAdminClient()
    const { data: employee } = await admin.from('employees').select('user_id').eq('email', email).maybeSingle()
    if (!employee?.user_id) return

    const { data: existing } = await admin.from('login_attempts').select('failed_count, locked_until, updated_at').eq('user_id', employee.user_id).maybeSingle()

    const withinWindow = existing?.updated_at && (Date.now() - new Date(existing.updated_at).getTime()) < WINDOW_MINUTES * 60_000
    const nextCount = (withinWindow ? existing?.failed_count ?? 0 : 0) + 1
    const lockedUntil = nextCount >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null

    await admin.from('login_attempts').upsert({
      user_id: employee.user_id,
      failed_count: nextCount,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Best-effort counter — never surface this to the login form.
  }
}

/**
 * Called once per successful sign-in, right after
 * supabase.auth.signInWithPassword() resolves on the login page. Takes the
 * access token from that response directly rather than reading the session
 * via cookies — the browser client's cookie write and this Server Action's
 * fetch can race (the action's request can leave before
 * signInWithPassword's cookie write lands), which was silently no-op'ing
 * the counter. Validating the token directly against Supabase sidesteps
 * that race entirely.
 *
 * Advances the employee's login counter — middleware reads login_count +
 * force_password_change to decide whether to gate the rest of the app
 * behind /change-password.
 */
export async function recordSuccessfulLogin(accessToken: string) {
  const admin = createAdminClient()
  const { data: { user } } = await admin.auth.getUser(accessToken)
  if (!user) return

  const { data: employee } = await admin
    .from('employees')
    .select('id, login_count')
    .eq('user_id', user.id)
    .single()
  if (!employee) return

  await admin.from('employees').update({ login_count: employee.login_count + 1 }).eq('id', employee.id)
  await admin.from('login_attempts').update({ failed_count: 0, locked_until: null }).eq('user_id', user.id)
}

/**
 * Called after the employee successfully sets a new password on
 * /change-password. Clears the forced flag and resets the counter so the
 * requirement doesn't immediately retrigger on their next sign-in.
 */
export async function clearForcedPasswordChange() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin
    .from('employees')
    .update({ force_password_change: false, login_count: 0 })
    .eq('user_id', user.id)
}
