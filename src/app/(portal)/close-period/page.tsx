import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getClosedPeriods } from '@/app/actions/close-period'
import { CLOSE_PERIOD_ROLES } from '@/lib/constants/approvals'
import { REOPEN_OVERRIDE_ROLES } from '@/lib/constants/timesheet-reopen'
import { getRecentPeriods, todayET } from '@/lib/pay-periods'
import ClosePeriodClient from '@/components/ClosePeriodClient'

export const dynamic = 'force-dynamic'

export default async function ClosePeriodPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !CLOSE_PERIOD_ROLES.includes(employee.role)) redirect('/dashboard')

  const history = await getClosedPeriods()
  return (
    <ClosePeriodClient
      history={history}
      canLift={REOPEN_OVERRIDE_ROLES.includes(employee.role)}
      today={todayET()}
      recentPeriods={getRecentPeriods(6)}
    />
  )
}
