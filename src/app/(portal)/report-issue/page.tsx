import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import ReportIssueClient from '@/components/ReportIssueClient'

export const dynamic = 'force-dynamic'

export default async function ReportIssuePage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')
  return <ReportIssueClient employeeName={employee.name} employeeEmail={employee.email} />
}
