import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getEmployees } from '@/app/actions/employees'
import { getGrants } from '@/app/actions/grants'
import AdminUsersClient from '@/components/AdminUsersClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const employee = await getCurrentEmployee()
  if (!employee || employee.role !== 'admin') redirect('/dashboard')

  const [employees, grants] = await Promise.all([getEmployees(), getGrants()])
  return <AdminUsersClient initialEmployees={employees} grants={grants.filter(g => g.is_active)} />
}
