import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { hasPayrollAccess } from '@/lib/constants/salary-access'
import { getAccrualState, getBalanceUpdateHistory, getSnapshotOverview, getAdjustableEmployees } from '@/app/actions/balances'
import { getRecentPeriods, getCurrentPeriod } from '@/lib/pay-periods'
import BalanceUpdateClient from '@/components/BalanceUpdateClient'
import BalanceReconcileClient from '@/components/BalanceReconcileClient'

export const dynamic = 'force-dynamic'

export default async function AdminBalancesPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !hasPayrollAccess(employee)) redirect('/admin')

  const [accrual, history, snapshots, employees] = await Promise.all([getAccrualState(), getBalanceUpdateHistory(), getSnapshotOverview(), getAdjustableEmployees()])
  // Periods the accrual can start from: the current one and the few before it.
  const periods = getRecentPeriods(6)
  return (
    <>
      <BalanceUpdateClient accrual={accrual} history={history} periods={periods} currentStart={getCurrentPeriod().start} />
      <BalanceReconcileClient snapshotAsOf={snapshots.asOf} snapshots={snapshots.rows} employees={employees} />
    </>
  )
}
