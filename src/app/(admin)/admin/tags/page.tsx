import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getManagedTags } from '@/app/actions/tags'
import { hasPayrollAccess } from '@/lib/constants/salary-access'
import TagsAdminClient from '@/components/TagsAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminTagsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !hasPayrollAccess(employee)) redirect('/admin')

  const tags = await getManagedTags()
  return <TagsAdminClient initialTags={tags} />
}
