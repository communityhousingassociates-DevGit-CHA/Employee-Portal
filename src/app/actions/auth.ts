'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
