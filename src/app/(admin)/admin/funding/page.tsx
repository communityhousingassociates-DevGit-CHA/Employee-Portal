import { canAccessFunding } from '@/lib/constants/funding'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getFunding } from '@/app/actions/funding'
import FundingClient from '@/components/FundingClient'

export const dynamic = 'force-dynamic'

export default async function AdminFundingPage() {
  const employee = await getCurrentEmployee()
  if (!canAccessFunding(employee)) redirect('/admin')

  const rows = await getFunding()
  return <FundingClient initialRows={rows} />
}
