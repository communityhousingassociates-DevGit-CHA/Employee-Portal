// Year-end carryover (SOP §4): unused annual (PTO) + Personal Days + sick hours carry over up to ONE combined limit, set by
// tenure — 240 hrs under 60 months, 400 hrs from 60 months; `pto_uncapped` employees (the CEO) keep everything. Run by the
// daily cron in January, before accruals so the new year's first credit isn't counted against last year's limit.
// Not a 'use server' file: it rewrites balances for many employees and must only run behind the cron secret.

import type { SupabaseClient } from '@supabase/supabase-js'
import { carryoverCap } from '@/lib/constants/accrual'
import { todayET } from '@/lib/pay-periods'

// Never trims for a year before this — the policy takes effect at the first year-end after it was adopted, so deploying
// mid-2026 can't touch balances loaded from CHA.
const FIRST_CARRYOVER_YEAR = 2027

export type CarryoverSummary = { ran: boolean; reason?: string; year?: number; trimmed?: number; hoursForfeited?: number; errors?: string[] }

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Order the excess is taken from: Personal Days first, then annual leave, then sick leave — so the leave with the most
 * legal protection (sick) is trimmed last. CHA's policy states the combined limit but not this order; confirm with CHA.
 */
export function trimToCap(b: { pto: number; sick: number; personal: number }, cap: number) {
  let excess = round2(b.pto + b.sick + b.personal - cap)
  const out = { ...b }
  if (excess <= 0) return out
  for (const k of ['personal', 'pto', 'sick'] as const) {
    const take = Math.min(out[k], excess)
    out[k] = round2(out[k] - take)
    excess = round2(excess - take)
    if (excess <= 0) break
  }
  return out
}

export async function runYearEndCarryover(admin: SupabaseClient, now: Date = new Date()): Promise<CarryoverSummary> {
  const today = todayET(now)
  const year = Number(today.slice(0, 4))
  if (year < FIRST_CARRYOVER_YEAR) return { ran: false, reason: `carryover starts with the ${FIRST_CARRYOVER_YEAR} year-end` }
  if (today.slice(5, 7) !== '01') return { ran: false, reason: 'carryover only runs in January' }

  const { data: done, error: doneError } = await admin.from('carryover_runs').select('year').eq('year', year).maybeSingle()
  if (doneError) return { ran: false, reason: doneError.message }
  if (done) return { ran: false, reason: `${year} carryover already applied` }

  const { data: employees, error: empError } = await admin.from('employees').select('id, hire_date, pto_uncapped').eq('is_active', true)
  if (empError) return { ran: false, reason: empError.message }

  const asOf = `${year - 1}-12-31`
  const asOfMs = Date.parse(`${asOf}T12:00:00Z`)
  const batchId = crypto.randomUUID()
  const errors: string[] = []
  let trimmed = 0
  let forfeited = 0

  for (const emp of employees ?? []) {
    if (emp.pto_uncapped) continue
    const { data: bal, error: balError } = await admin.from('leave_balances').select('pto_hours, sick_hours, personal_hours').eq('employee_id', emp.id).maybeSingle()
    if (balError || !bal) { errors.push(`${emp.id}: ${balError?.message ?? 'no leave_balances row'}`); continue }

    const before = { pto: Number(bal.pto_hours), sick: Number(bal.sick_hours), personal: Number(bal.personal_hours) }
    const cap = carryoverCap(emp.hire_date, asOfMs)
    const after = trimToCap(before, cap)
    const lost = round2(before.pto + before.sick + before.personal - (after.pto + after.sick + after.personal))
    if (lost <= 0) continue

    const { error: updateError } = await admin.from('leave_balances').update({ pto_hours: after.pto, sick_hours: after.sick, personal_hours: after.personal }).eq('employee_id', emp.id)
    if (updateError) { errors.push(`${emp.id}: ${updateError.message}`); continue }
    const { error: auditError } = await admin.from('balance_adjustments').insert({
      batch_id: batchId, employee_id: emp.id, as_of: asOf, kind: 'adjustment',
      old_pto: before.pto, old_sick: before.sick, old_personal: before.personal,
      new_pto: after.pto, new_sick: after.sick, new_personal: after.personal,
      reason: `Year-end carryover ${year - 1}→${year}: combined limit ${cap} hrs, ${lost} hrs forfeited`,
    })
    if (auditError) errors.push(`${emp.id}: audit row failed (${auditError.message})`)
    trimmed++
    forfeited = round2(forfeited + lost)
  }

  // Only mark the year done when every employee went through cleanly, so a failed run retries on the next cron.
  if (errors.length === 0) {
    const { error: markError } = await admin.from('carryover_runs').insert({ year, employees_trimmed: trimmed, hours_forfeited: forfeited })
    if (markError) errors.push(`marking ${year} done failed: ${markError.message}`)
  }
  return { ran: true, year, trimmed, hoursForfeited: forfeited, errors }
}
