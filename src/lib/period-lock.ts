// Server-side lookup of accounting's active period closures. Not a 'use server' file (see leave-timesheet.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClosedRange } from '@/lib/pay-periods'

/** Active (not lifted) closed date ranges. */
export async function loadClosedRanges(admin: SupabaseClient): Promise<ClosedRange[]> {
  const { data, error } = await admin.from('closed_periods').select('start_date, end_date').is('lifted_at', null)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => ({ start: r.start_date as string, end: r.end_date as string }))
}
