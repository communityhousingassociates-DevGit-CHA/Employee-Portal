import { getIssueReports, markIssuesSeen } from '@/app/actions/report-issue'
import IssuesClient from '@/components/IssuesClient'

export const dynamic = 'force-dynamic'

export default async function IssuesPage() {
  const issues = await getIssueReports()
  await markIssuesSeen()
  return <IssuesClient initialIssues={issues} />
}
