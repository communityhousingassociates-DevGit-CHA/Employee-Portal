// Annual-leave payout on voluntary resignation (SOP §4 "Payout on separation"): CHA pays up to 120 hours of accrued annual leave
// (PTO) if a Director gives at least 4 weeks' notice, or a non-Director at least 2 weeks' notice, of the effective date of the
// resignation. Otherwise no accrued annual leave is paid, and accrued sick leave is never paid. Pure — client-safe.

export const RESIGNATION_PAYOUT_CAP_HOURS = 120
export const DIRECTOR_NOTICE_DAYS = 28
export const NON_DIRECTOR_NOTICE_DAYS = 14

export type PayoutResult = { noticeDays: number; requiredDays: number; noticeMet: boolean; ptoBalance: number; payoutHours: number; explanation: string }

/** `noticeDate` = the day the employee gave notice; `lastDay` = the effective date of the resignation (both YYYY-MM-DD). */
export function resignationPayout(input: { isDirector: boolean; ptoBalance: number; noticeDate: string; lastDay: string }): PayoutResult {
  const noticeDays = Math.round((Date.parse(`${input.lastDay}T00:00:00Z`) - Date.parse(`${input.noticeDate}T00:00:00Z`)) / 86400000)
  const requiredDays = input.isDirector ? DIRECTOR_NOTICE_DAYS : NON_DIRECTOR_NOTICE_DAYS
  const noticeMet = noticeDays >= requiredDays
  const ptoBalance = Math.max(0, input.ptoBalance)
  const payoutHours = noticeMet ? Math.min(RESIGNATION_PAYOUT_CAP_HOURS, ptoBalance) : 0
  const role = input.isDirector ? 'Director (4 weeks)' : 'non-Director (2 weeks)'
  const explanation = noticeMet
    ? `${noticeDays} days' notice meets the ${role} requirement. Payout is the lesser of the ${RESIGNATION_PAYOUT_CAP_HOURS}-hr cap and the ${ptoBalance}-hr annual leave balance. Sick leave is never paid out.`
    : `${noticeDays} days' notice is short of the ${requiredDays} days required for a ${role}. No accrued annual leave is paid. Sick leave is never paid out.`
  return { noticeDays, requiredDays, noticeMet, ptoBalance, payoutHours, explanation }
}
