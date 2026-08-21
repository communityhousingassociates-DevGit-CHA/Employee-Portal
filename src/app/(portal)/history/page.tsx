import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getLeaveHistory } from '@/app/actions/leave-requests'
import HistoryClient from '@/components/HistoryClient'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const requests = await getLeaveHistory()
  return <HistoryClient initialRequests={requests} />
}
