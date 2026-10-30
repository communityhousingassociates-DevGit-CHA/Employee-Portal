// Shared (cross-instance) request counter backed by Postgres (migration 046). Used by middleware.ts as a second line behind the
// per-instance in-memory limit. It must never take the site down: any error or slow answer is treated as "not limited".

import type { SupabaseClient } from '@supabase/supabase-js'

/** True when this key is over its limit for the current window; false when it is not, or when the answer is unknown (fails open). */
export async function sharedRateLimited(
  admin: Pick<SupabaseClient, 'rpc'>,
  key: string,
  limit: number,
  windowSeconds: number,
  timeoutMs = 800,
): Promise<boolean> {
  try {
    const call = Promise.resolve(admin.rpc('rate_limit_hit', { p_key: key, p_window_seconds: windowSeconds, p_limit: limit }))
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('rate limit lookup timed out')), timeoutMs))
    const { data, error } = await Promise.race([call, timeout])
    if (error) return false
    return data === true
  } catch {
    return false
  }
}
