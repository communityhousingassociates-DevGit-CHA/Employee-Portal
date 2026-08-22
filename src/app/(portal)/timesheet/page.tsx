import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getOrCreateTimesheet } from '@/app/actions/timesheets'
import { getExpensesForPeriod } from '@/app/actions/expenses'
import { getMySalary } from '@/app/actions/salary'
import { getPeriodsSince } from '@/lib/pay-periods'
import TimesheetClient from '@/components/TimesheetClient'

export const dynamic = 'force-dynamic'

export default async function TimesheetPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const periods = getPeriodsSince(employee.hire_date)
  const current = periods[0]
  const [{ timesheet, rows }, expenses, salary] = await Promise.all([
    getOrCreateTimesheet(current.start, current.end),
    getExpensesForPeriod(employee.id, current.start, current.end),
    getMySalary(),
  ])

  return (
    <TimesheetClient
      employeeName={employee.name}
      employeeNumber={employee.employee_number}
      periods={periods}
      initialTimesheet={timesheet}
      initialRows={rows}
      initialExpenses={expenses}
      salary={salary}
    />
  )
}
