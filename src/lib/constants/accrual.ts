import { DEFAULT_POLICY, perPeriod, type PolicySettings } from '@/lib/policy'

// Single source of truth for CHA's leave accrual policy.
// Rates/cap sourced from onboarding/Leave_Balance_Validation.xlsx's Accrual Policy Reference block.

export const ACCRUAL_TIERS = [
  { maxMonths: 12, label: '0–12 mo', ptoRate: 4.62 },
  { maxMonths: 24, label: '13–24 mo', ptoRate: 5.08 },
  { maxMonths: 36, label: '25–36 mo', ptoRate: 5.54 },
  { maxMonths: Infinity, label: '36+ mo', ptoRate: 6.00 },
] as const

export const SICK_RATE_PER_PERIOD = 3.69 // fixed, no tiers

// Year-end carryover (SOP §4): unused annual + personal + sick leave carry over up to ONE combined limit, set by tenure at
// year-end. The CEO (`pto_uncapped`) is exempt. Nothing is capped mid-year — the limit is applied once, by the year-end job.
export const CARRYOVER_CAP_UNDER_60_MONTHS = 240
export const CARRYOVER_CAP_60_MONTHS_PLUS = 400
export const CARRYOVER_TENURE_MONTHS = 60

export function tenureMonths(hireDate: string, asOf: number = Date.now()): number {
  return Math.floor((asOf - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}

export function carryoverCap(hireDate: string, asOf: number = Date.now(), policy: PolicySettings = DEFAULT_POLICY): number {
  return tenureMonths(hireDate, asOf) >= CARRYOVER_TENURE_MONTHS ? policy.carryover_cap_60_months_plus : policy.carryover_cap_under_60_months
}

// Waiting periods (SOP §4): no annual (PTO) or sick leave before 90 days of employment, no Personal Days before 6 months.
export const WAITING_DAYS_PTO_SICK = 90
export const WAITING_MONTHS_PERSONAL = 6

/** First date `leaveType` may be taken (YYYY-MM-DD), or null when no waiting period applies. */
export function firstEligibleDate(hireDate: string, leaveType: string, policy: PolicySettings = DEFAULT_POLICY): string | null {
  const d = new Date(`${hireDate}T00:00:00Z`)
  if (leaveType === 'PTO' || leaveType === 'Sick') { d.setUTCDate(d.getUTCDate() + policy.new_hire_waiting_days); return d.toISOString().slice(0, 10) }
  if (leaveType === 'Personal') { d.setUTCMonth(d.getUTCMonth() + policy.personal_waiting_months); return d.toISOString().slice(0, 10) }
  return null
}

// Notice (SOP §4): planned annual leave should be requested at least a week ahead; foreseeable sick leave needs 7 days.
export const ADVANCE_NOTICE_DAYS = 7

export function calcTier(hireDate: string, asOf: number = Date.now(), policy: PolicySettings = DEFAULT_POLICY): { tier: string; ptoRate: number } {
  const months = tenureMonths(hireDate, asOf)
  const index = ACCRUAL_TIERS.findIndex(t => months < t.maxMonths)
  const i = index === -1 ? ACCRUAL_TIERS.length - 1 : index
  const hoursPerYear = [policy.pto_tier_0_12, policy.pto_tier_13_24, policy.pto_tier_25_36, policy.pto_tier_36_plus][i]
  return { tier: ACCRUAL_TIERS[i].label, ptoRate: perPeriod(hoursPerYear) }
}
