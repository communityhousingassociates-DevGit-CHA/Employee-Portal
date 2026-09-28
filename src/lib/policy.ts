// Leave-policy numbers CHA can adjust under Admin → Portal Settings. Defaults are the SOP values; anything missing or invalid in the
// saved settings falls back to them, so a bad save can never leave the accrual engine without a rate. Pure — safe on the client.

export type PolicySettings = {
  pto_tier_0_12: number // annual leave hours per year, by tenure
  pto_tier_13_24: number
  pto_tier_25_36: number
  pto_tier_36_plus: number
  sick_rate_per_pp: number // sick hours per pay period
  personal_hours_per_year: number // Personal Days granted each January 1
  carryover_cap_under_60_months: number // combined annual + personal + sick, applied at year-end
  carryover_cap_60_months_plus: number
  new_hire_waiting_days: number // annual (PTO) and sick leave
  personal_waiting_months: number
  approval_reminder_days: number
}

export const DEFAULT_POLICY: PolicySettings = {
  pto_tier_0_12: 120,
  pto_tier_13_24: 132,
  pto_tier_25_36: 144,
  pto_tier_36_plus: 156,
  sick_rate_per_pp: 3.69,
  personal_hours_per_year: 24,
  carryover_cap_under_60_months: 240,
  carryover_cap_60_months_plus: 400,
  new_hire_waiting_days: 90,
  personal_waiting_months: 6,
  approval_reminder_days: 2,
}

export const POLICY_KEYS = Object.keys(DEFAULT_POLICY) as (keyof PolicySettings)[]
export const PAY_PERIODS_PER_YEAR = 26

/** Saved values merged over the defaults; a non-number or negative value is ignored. */
export function resolvePolicy(saved: Record<string, unknown> | null | undefined): PolicySettings {
  const out = { ...DEFAULT_POLICY }
  for (const key of POLICY_KEYS) {
    const v = saved?.[key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v
  }
  return out
}

/** Hours per pay period for an annual-hours figure (120 → 4.62, 132 → 5.08, 144 → 5.54, 156 → 6.00). */
export function perPeriod(hoursPerYear: number): number {
  return Math.round((hoursPerYear / PAY_PERIODS_PER_YEAR) * 100) / 100
}
