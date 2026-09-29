import { isAdminRole } from '@/lib/constants/admin-access'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getGrants } from '@/app/actions/grants'
import GrantsClient from '@/components/GrantsClient'

export const dynamic = 'force-dynamic'

export default async function AdminGrantsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !isAdminRole(employee.role)) redirect('/dashboard')

  const grants = await getGrants()
  return <GrantsClient initialGrants={grants} />
}
