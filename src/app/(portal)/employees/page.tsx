import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getEmployeeDirectory } from '@/app/actions/employees'
import EmployeesClient from '@/components/EmployeesClient'
import { canActOnBehalf } from '@/lib/constants/on-behalf'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !['ceo', 'admin'].includes(employee.role)) redirect('/dashboard')

  const employees = await getEmployeeDirectory()
  // Only the named people (Nico, Carrileen, super admin) get the on-behalf shortcuts; the server enforces it again on every action.
  return <EmployeesClient employees={employees} actOnBehalf={canActOnBehalf(employee)} viewerId={employee.id} />
}
