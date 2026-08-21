import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getMyBalance } from '@/app/actions/leave-requests'
import RequestClient from '@/components/RequestClient'
import { formatEmployeeId } from '@/lib/constants/employee-id'

export const dynamic = 'force-dynamic'

export default async function RequestPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const balance = await getMyBalance()

  return (
    <RequestClient
      employeeName={employee.name}
      employeeIdLabel={formatEmployeeId(employee.employee_number)}
      balance={balance}
    />
  )
}
