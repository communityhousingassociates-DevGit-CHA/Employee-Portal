import type { SupabaseClient } from '@supabase/supabase-js'

/** Ids of employees flagged `is_test_account` — used to keep workflow-testing data out of real staff's view (calendar, directory, approvals) and out of reports. */
export async function getTestAccountIds(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin.from('employees').select('id').eq('is_test_account', true)
  return new Set((data ?? []).map(r => r.id as string))
}
