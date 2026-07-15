import { MOCK_REPORT_ROWS, MOCK_TIMESHEET_ROWS, MOCK_USER } from '@/lib/mock-data'
import ReportsClient, { type ReportRow, type TimesheetSummaryRow } from '@/components/ReportsClient'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

function toInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function ReportsPage() {
  let role = 'employee'
  let currentUserName = MOCK_USER.name

  const cookieStore = await cookies()
  const isDemo = cookieStore.get('cha-demo')?.value === 'true'

  if (isDemo) {
    role = MOCK_USER.role
  } else {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: emp } = await supabase
          .from('employees')
          .select('name, role')
          .eq('user_id', user.id)
          .single()
        if (emp) {
          role = emp.role
          currentUserName = emp.name
        }
      }
    } catch {}
  }

  const isManager = MANAGER_ROLES.includes(role)

  const rows: ReportRow[] = (
    isManager
      ? MOCK_REPORT_ROWS
      : MOCK_REPORT_ROWS.filter(r => r.name === currentUserName)
  ).map(r => ({ ...r, initials: toInitials(r.name) }))

  const timesheetRows: TimesheetSummaryRow[] = MOCK_TIMESHEET_ROWS.map(r => ({ ...r, initials: toInitials(r.name) }))

  return <ReportsClient rows={rows} timesheetRows={timesheetRows} isManager={isManager} />
}
