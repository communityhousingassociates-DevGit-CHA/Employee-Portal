// Single source of truth for CHA's leave accrual policy.
// Rates/cap sourced from onboarding/Leave_Balance_Validation.xlsx's Accrual Policy Reference block.

export const ACCRUAL_TIERS = [
  { maxMonths: 12, label: '0–12 mo', ptoRate: 4.62 },
  { maxMonths: 24, label: '13–24 mo', ptoRate: 5.08 },
  { maxMonths: 36, label: '25–36 mo', ptoRate: 5.54 },
  { maxMonths: Infinity, label: '36+ mo', ptoRate: 6.00 },
] as const

export const SICK_RATE_PER_PERIOD = 3.69 // fixed, no tiers
export const PTO_CARRYOVER_CAP = 400 // hours; sick is uncapped

export function calcTier(hireDate: string): { tier: string; ptoRate: number } {
  const months = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  const matched = ACCRUAL_TIERS.find(t => months < t.maxMonths) ?? ACCRUAL_TIERS[ACCRUAL_TIERS.length - 1]
  return { tier: matched.label, ptoRate: matched.ptoRate }
}
