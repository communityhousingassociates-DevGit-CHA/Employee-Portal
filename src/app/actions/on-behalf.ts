'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { canActOnBehalf } from '@/lib/constants/on-behalf'
import type { YearEndChoice } from '@/lib/holidays'

/** The employee an admin is about to complete something for. Throws unless the caller is one of the people allowed to act on behalf. */
export async function getOnBehalfTarget(employeeId: string) {
  const actor = await getCurrentEmployee()
  if (!actor || !canActOnBehalf(actor)) throw new Error('Forbidden')
  const { data, error } = await createAdminClient()
    .from('employees')
    .select('id, name, employee_number, employee_type, year_end_holiday, hire_date, is_active')
    .eq('id', employeeId)
    .single()
  if (error || !data) throw new Error('Employee not found')
  // Only WHETHER they're salaried (hours auto-fill to 8/day) — never the amount.
  const { data: sal } = await createAdminClient().from('employee_current_salary').select('employee_id').eq('employee_id', employeeId).maybeSingle()
  return { ...(data as { id: string; name: string; employee_number: number; employee_type: string; year_end_holiday: YearEndChoice | null; hire_date: string; is_active: boolean }), salaried: !!sal }
}
