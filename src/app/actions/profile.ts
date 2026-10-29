'use server'

import { UserError } from '@/lib/user-error'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new UserError('Not authenticated')
  return user.id
}

export async function updateProfile(data: {
  first_name: string
  last_name: string
  middle_initial: string | null
  job_title: string | null
  department: string | null
}) {
  const userId = await getAuthUserId()
  // Server Action arguments are untrusted at runtime — the TypeScript type is not enforced. Write only these five fields, never
  // the object as received, or a caller could add `role`, `is_super_admin`, etc. and promote themselves.
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const first_name = text(data?.first_name, 80)
  const last_name = text(data?.last_name, 80)
  if (!first_name || !last_name) throw new UserError('First and last name are required.')
  const optional = (v: unknown, max: number) => text(v, max) || null
  const clean = {
    first_name,
    last_name,
    middle_initial: optional(data?.middle_initial, 3),
    job_title: optional(data?.job_title, 120),
    department: optional(data?.department, 120),
  }
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update(clean).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Sets the employee's paid year-end holiday: Christmas Eve or New Year's Eve (SOP §4). It can be changed until December 1
 * so a timesheet already covering the day is never rewritten under someone. New choices apply to timesheets created from then on.
 */
export async function setYearEndHoliday(choice: 'christmas_eve' | 'new_years_eve') {
  if (choice !== 'christmas_eve' && choice !== 'new_years_eve') throw new UserError('Choose Christmas Eve or New Year’s Eve.')
  const userId = await getAuthUserId()
  const admin = createAdminClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const { data: emp, error: readError } = await admin.from('employees').select('year_end_holiday').eq('user_id', userId).single()
  if (readError) throw new Error(readError.message)
  if (emp.year_end_holiday && emp.year_end_holiday !== choice && today.slice(5, 7) === '12') {
    throw new UserError('Your year-end holiday is locked as of December 1. Contact your Accounting Manager to change it.')
  }
  const { error } = await admin.from('employees').update({ year_end_holiday: choice }).eq('user_id', userId)
  if (error) throw new Error(error.message)
}
