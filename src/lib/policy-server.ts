// Loads the saved Portal Settings policy numbers (server only). Callers that make a policy decision — accruals, carryover,
// waiting periods, projections — load it here and pass it down so everything in one request agrees.

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePolicy, type PolicySettings } from '@/lib/policy'

export async function loadPolicy(admin: SupabaseClient): Promise<PolicySettings> {
  const { data } = await admin.from('portal_settings').select('values').maybeSingle()
  return resolvePolicy(data?.values as Record<string, unknown> | undefined)
}
