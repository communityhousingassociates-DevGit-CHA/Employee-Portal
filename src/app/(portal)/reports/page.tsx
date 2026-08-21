import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getReportSummary } from '@/app/actions/reports'
import { getRecentPeriods } from '@/lib/pay-periods'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const periods = getRecentPeriods(8)
  const current = periods[0]
  const summary = await getReportSummary(current.start, current.end)

  return <ReportsClient periods={periods} initialSummary={summary} />
}
