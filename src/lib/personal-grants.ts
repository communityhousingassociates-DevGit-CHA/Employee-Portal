// Personal Days grant (SOP §4): each full-time employee receives 24 hours (3 days) on January 1. Run by the daily cron in
// January, right after the year-end carryover trim, so the new grant is never counted against last year's carryover limit.
// Not a 'use server' file: it rewrites balances for many employees and must only run behind the cron secret.

import type { SupabaseClient } from '@supabase/supabase-js'
import { todayET } from '@/lib/pay-periods'

export const PERSONAL_DAYS_ANNUAL_HOURS = 24

// Same guard as carryover: the first grant is January 1, 2027 — 2026 balances were loaded from CHA, already including this year's days.
const FIRST_GRANT_YEAR = 2027

export type PersonalGrantSummary = { ran: boolean; reason?: string; year?: number; granted?: number; errors?: string[] }

export async function runPersonalDaysGrant(admin: SupabaseClient, now: Date = new Date()): Promise<PersonalGrantSummary> {
  const today = todayET(now)
  const year = Number(today.slice(0, 4))
  if (year < FIRST_GRANT_YEAR) return { ran: false, reason: `the first Personal Days grant is January 1, ${FIRST_GRANT_YEAR}` }
  if (today.slice(5, 7) !== '01') return { ran: false, reason: 'the Personal Days grant only runs in January' }

  const { data: done, error: doneError } = await admin.from('personal_grants').select('year').eq('year', year).maybeSingle()
  if (doneError) return { ran: false, reason: doneError.message }
  if (done) return { ran: false, reason: `${year} grant already applied` }

  // Carryover must have been applied for this year first, or the trim would eat the new grant.
  const { data: carried } = await admin.from('carryover_runs').select('year').eq('year', year).maybeSingle()
  if (!carried) return { ran: false, reason: `waiting for the ${year} year-end carryover to run first` }

  const { data: employees, error: empError } = await admin.from('employees').select('id').eq('is_active', true).eq('employee_type', 'full-time')
  if (empError) return { ran: false, reason: empError.message }

  const errors: string[] = []
  let granted = 0
  for (const emp of employees ?? []) {
    const { data: bal, error: balError } = await admin.from('leave_balances').select('personal_hours').eq('employee_id', emp.id).maybeSingle()
    if (balError || !bal) { errors.push(`${emp.id}: ${balError?.message ?? 'no leave_balances row'}`); continue }
    const before = Number(bal.personal_hours)
    const after = Math.round((before + PERSONAL_DAYS_ANNUAL_HOURS) * 100) / 100
    const { error: updateError } = await admin.from('leave_balances').update({ personal_hours: after }).eq('employee_id', emp.id)
    if (updateError) { errors.push(`${emp.id}: ${updateError.message}`); continue }
    granted++
  }

  if (errors.length === 0) {
    const { error: markError } = await admin.from('personal_grants').insert({ year, employees_granted: granted })
    if (markError) errors.push(`marking ${year} done failed: ${markError.message}`)
  }
  return { ran: true, year, granted, errors }
}
