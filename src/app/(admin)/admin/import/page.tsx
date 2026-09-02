import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getImportApprover, getPendingImportBatches } from '@/app/actions/import'
import AdminImportClient from '@/components/AdminImportClient'

export const dynamic = 'force-dynamic'

export default async function AdminImportPage() {
  const employee = await getCurrentEmployee()
  if (!employee || employee.role !== 'admin') redirect('/dashboard')
  const { isSuperAdmin, superAdminName } = await getImportApprover()
  const pendingBatches = isSuperAdmin ? await getPendingImportBatches() : []
  return <AdminImportClient isSuperAdmin={isSuperAdmin} superAdminName={superAdminName} initialPendingBatches={pendingBatches} />
}
