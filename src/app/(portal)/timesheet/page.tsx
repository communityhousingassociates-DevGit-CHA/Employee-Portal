import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getOrCreateTimesheet } from '@/app/actions/timesheets'
import { getActiveClosedRanges } from '@/app/actions/close-period'
import { getTagList } from '@/app/actions/tags'
import { getExpensesForPeriod } from '@/app/actions/expenses'
import { getMySalary } from '@/app/actions/salary'
import { getPeriodsSince } from '@/lib/pay-periods'
import { getOnBehalfTarget } from '@/app/actions/on-behalf'
import { ON_BEHALF_ROLES } from '@/lib/constants/on-behalf'
import TimesheetClient from '@/components/TimesheetClient'

export const dynamic = 'force-dynamic'

export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forId } = await searchParams
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  // An admin completing this for someone else (an exception — see OnBehalfPanel). Anyone else asking for it is sent home.
  let subject: { id: string; name: string; employee_number: number; employee_type: typeof employee.employee_type; year_end_holiday: typeof employee.year_end_holiday; hire_date: string } = employee
  let onBehalf: { employeeId: string; actorName: string } | undefined
  let targetSalaried: boolean | undefined
  if (forId && forId !== employee.id) {
    if (!ON_BEHALF_ROLES.includes(employee.role)) redirect('/dashboard')
    const target = await getOnBehalfTarget(forId).catch(() => null)
    if (!target || !target.is_active) redirect('/employees')
    subject = { ...target, employee_type: target.employee_type as typeof employee.employee_type }
    targetSalaried = target.salaried
    onBehalf = { employeeId: target.id, actorName: employee.name }
  }

  const periods = getPeriodsSince(subject.hire_date)
  const current = periods[0]
  const [{ timesheet, rows }, expenses, salary, closedRanges, customTags] = await Promise.all([
    getOrCreateTimesheet(current.start, current.end, onBehalf?.employeeId),
    getExpensesForPeriod(subject.id, current.start, current.end),
    onBehalf ? Promise.resolve(null) : getMySalary(), // on behalf of someone: never load their pay
    getActiveClosedRanges(),
    getTagList(),
  ])

  return (
    <TimesheetClient
      employeeName={subject.name}
      employeeNumber={subject.employee_number}
      employeeType={subject.employee_type}
      yearEnd={subject.year_end_holiday}
      salaried={onBehalf ? !!targetSalaried : salary !== null}
      onBehalf={onBehalf}
      periods={periods}
      initialTimesheet={timesheet}
      initialRows={rows}
      initialExpenses={expenses}
      salary={salary}
      closedRanges={closedRanges}
      customTags={customTags}
    />
  )
}
