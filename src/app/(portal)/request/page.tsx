import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getMyBalance, getMyLeaveOutlook, getMyBookedLeaveDays } from '@/app/actions/leave-requests'
import { getOnBehalfTarget } from '@/app/actions/on-behalf'
import { ON_BEHALF_ROLES } from '@/lib/constants/on-behalf'
import { getActiveClosedRanges } from '@/app/actions/close-period'
import RequestClient from '@/components/RequestClient'
import { formatEmployeeId } from '@/lib/constants/employee-id'

export const dynamic = 'force-dynamic'

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ date?: string; for?: string }> }) {
  const { date, for: forId } = await searchParams
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  // An admin completing this for someone else (an exception — see OnBehalfPanel). Anyone else asking for it is sent home.
  let subject: { id: string; name: string; employee_number: number; year_end_holiday: typeof employee.year_end_holiday } = employee
  let onBehalf: { employeeId: string; actorName: string } | undefined
  if (forId && forId !== employee.id) {
    if (!ON_BEHALF_ROLES.includes(employee.role)) redirect('/dashboard')
    const target = await getOnBehalfTarget(forId).catch(() => null)
    if (!target || !target.is_active) redirect('/employees')
    subject = target
    onBehalf = { employeeId: target.id, actorName: employee.name }
  }

  const [balance, closedRanges, outlook, bookedDays] = await Promise.all([getMyBalance(onBehalf?.employeeId), getActiveClosedRanges(), getMyLeaveOutlook(onBehalf?.employeeId), getMyBookedLeaveDays(onBehalf?.employeeId)])

  return (
    <RequestClient
      employeeName={subject.name}
      employeeIdLabel={formatEmployeeId(subject.employee_number)}
      onBehalf={onBehalf}
      balance={balance}
      initialDate={date}
      yearEnd={subject.year_end_holiday}
      closedRanges={closedRanges}
      bookedDays={bookedDays}
      outlook={{ policy: outlook.policy, hireDate: outlook.hireDate, ptoUncapped: outlook.ptoUncapped, accrualsOn: outlook.accrualsOn, reserved: outlook.reserved }}
    />
  )
}
