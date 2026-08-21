import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getEmployeeDirectory } from '@/app/actions/employees'
import EmployeesClient from '@/components/EmployeesClient'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !['ceo', 'admin'].includes(employee.role)) redirect('/dashboard')

  const employees = await getEmployeeDirectory()
  return <EmployeesClient employees={employees} />
}
