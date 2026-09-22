import { getIssueReports } from '@/app/actions/report-issue'
import IssuesClient from '@/components/IssuesClient'

export const dynamic = 'force-dynamic'

export default async function IssuesPage() {
  const issues = await getIssueReports()
  return <IssuesClient initialIssues={issues} />
}
