// Sign-in facts about portal accounts, read from Supabase Auth (server only).
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuthUserInfo = { passwordSet: boolean; invitedAt: string | null }

/**
 * Per auth user: whether they have set a password through the portal, and when their invite was sent (Supabase's `invited_at`;
 * re-sending an invite replaces the account, so this is always the latest send). Read from the Admin API rather than
 * `last_sign_in_at`, because a mail scanner opening the invite link counts as a sign-in and used to hide people who never
 * set a password.
 */
export async function getAuthUserInfo(admin: SupabaseClient): Promise<Map<string, AuthUserInfo>> {
  const map = new Map<string, AuthUserInfo>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    for (const u of data.users) {
      map.set(u.id, { passwordSet: !!(u.user_metadata as { password_set_at?: string } | null)?.password_set_at, invitedAt: u.invited_at ?? null })
    }
    if (data.users.length < 1000) break
  }
  return map
}
