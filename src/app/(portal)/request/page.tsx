import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getMyBalance, getMyLeaveOutlook } from '@/app/actions/leave-requests'
import { getActiveClosedRanges } from '@/app/actions/close-period'
import RequestClient from '@/components/RequestClient'
import { formatEmployeeId } from '@/lib/constants/employee-id'

export const dynamic = 'force-dynamic'

export default async function RequestPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const [balance, closedRanges, outlook] = await Promise.all([getMyBalance(), getActiveClosedRanges(), getMyLeaveOutlook()])

  return (
    <RequestClient
      employeeName={employee.name}
      employeeIdLabel={formatEmployeeId(employee.employee_number)}
      balance={balance}
      closedRanges={closedRanges}
      outlook={{ hireDate: outlook.hireDate, ptoUncapped: outlook.ptoUncapped, accrualsOn: outlook.accrualsOn, reserved: outlook.reserved }}
    />
  )
}
