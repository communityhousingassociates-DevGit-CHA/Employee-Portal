import { getEmployees } from '@/app/actions/employees'
import AdminUsersClient from '@/components/AdminUsersClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const employees = await getEmployees()
  return <AdminUsersClient initialEmployees={employees} />
}
