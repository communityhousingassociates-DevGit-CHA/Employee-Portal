// Projected leave balances. Future leave isn't deducted when approved — it is RESERVED and comes off the balance when the
// leave begins — so whether a future request is valid depends on the balance that will exist on that day:
//   projected = current balance + accruals between now and then − other leave already reserved up to then.
// Pure and client-safe (used by the request form, the dashboard, and the approval check).

import { calcTier, SICK_RATE_PER_PERIOD, PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'
import { getCurrentPeriod } from '@/lib/pay-periods'
import type { LeaveType } from '@/types'

export type BalanceType = 'pto' | 'sick' | 'vacation'

export function balanceTypeFor(leaveType: LeaveType): BalanceType | null {
  if (leaveType === 'PTO') return 'pto'
  if (leaveType === 'Sick') return 'sick'
  if (leaveType === 'Personal') return 'vacation'
  return null // Bereavement, Jury Duty draw from no balance
}

export type ReservedLeave = { id: string; leave_type: LeaveType; start_date: string; hours: number }

export type ProjectionInput = {
  type: BalanceType
  onDate: string // YYYY-MM-DD the leave begins
  current: number // balance today
  reserved: ReservedLeave[] // approved, not-yet-deducted leave (exclude the request being judged)
  hireDate: string
  ptoUncapped: boolean
  accrualsOn: boolean
  now?: Date
}

export type Projection = { projected: number; accrued: number; reservedBefore: number; periods: number }

/** Pay periods that start after today's and on/before `onDate` — each credits one accrual once accruals are on. */
function periodsAhead(onDate: string, now: Date): number {
  const currentStart = getCurrentPeriod(undefined, now).start
  const targetStart = getCurrentPeriod(undefined, new Date(`${onDate}T12:00:00Z`)).start
  const days = Math.round((Date.parse(`${targetStart}T00:00:00Z`) - Date.parse(`${currentStart}T00:00:00Z`)) / 86400000)
  return Math.max(0, Math.round(days / 14))
}

export function projectedAvailable(input: ProjectionInput): Projection {
  const now = input.now ?? new Date()
  const periods = input.accrualsOn ? periodsAhead(input.onDate, now) : 0

  let accrued = 0
  if (periods > 0) {
    if (input.type === 'pto') accrued = periods * calcTier(input.hireDate, Date.parse(`${input.onDate}T12:00:00Z`)).ptoRate
    else if (input.type === 'sick') accrued = periods * SICK_RATE_PER_PERIOD
    // Vacation ("personal") doesn't accrue.
  }

  let base = input.current + accrued
  if (input.type === 'pto' && !input.ptoUncapped) base = Math.min(base, PTO_CARRYOVER_CAP)

  const reservedBefore = input.reserved
    .filter(r => balanceTypeFor(r.leave_type) === input.type && r.start_date <= input.onDate)
    .reduce((s, r) => s + Number(r.hours), 0)

  return {
    projected: Math.round((base - reservedBefore) * 100) / 100,
    accrued: Math.round(accrued * 100) / 100,
    reservedBefore: Math.round(reservedBefore * 100) / 100,
    periods,
  }
}
