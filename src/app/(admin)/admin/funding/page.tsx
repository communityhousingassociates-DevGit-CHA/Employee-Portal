import { canAccessFunding } from '@/lib/constants/funding'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getFunding, getProfile, getSearchStatus, getSuggestions } from '@/app/actions/funding'
import FundingClient from '@/components/FundingClient'

export const dynamic = 'force-dynamic'
// The funder search runs as a server action on this route and can take a few minutes.
export const maxDuration = 300

export default async function AdminFundingPage() {
  const employee = await getCurrentEmployee()
  if (!canAccessFunding(employee)) redirect('/admin')

  const [rows, profile, suggestions, searchStatus] = await Promise.all([getFunding(), getProfile(), getSuggestions(), getSearchStatus()])
  return <FundingClient initialRows={rows} initialProfile={profile} initialSuggestions={suggestions} searchStatus={searchStatus} />
}
