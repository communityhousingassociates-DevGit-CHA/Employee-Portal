import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getOrCreateTimesheet, viewTimesheet, getTimesheetPeople } from '@/app/actions/timesheets'
import { getActiveClosedRanges } from '@/app/actions/close-period'
import { getTagList } from '@/app/actions/tags'
import { getExpensesForPeriod } from '@/app/actions/expenses'
import { getMySalary } from '@/app/actions/salary'
import { getPeriodsSince } from '@/lib/pay-periods'
import { getOnBehalfTarget } from '@/app/actions/on-behalf'
import { canActOnBehalf } from '@/lib/constants/on-behalf'
import { REOPEN_OVERRIDE_ROLES } from '@/lib/constants/timesheet-reopen'
import TimesheetClient from '@/components/TimesheetClient'

export const dynamic = 'force-dynamic'

export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ for?: string; period?: string }> }) {
  const { for: forId, period: periodParam } = await searchParams
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  // An admin completing this for someone else (an exception — see OnBehalfPanel). Anyone else asking for it is sent home.
  let subject: { id: string; name: string; employee_number: number; employee_type: typeof employee.employee_type; year_end_holiday: typeof employee.year_end_holiday; hire_date: string } = employee
  let onBehalf: { employeeId: string; actorName: string } | undefined
  let targetSalaried: boolean | undefined
  if (forId && forId !== employee.id) {
    if (!canActOnBehalf(employee)) redirect('/dashboard')
    const target = await getOnBehalfTarget(forId).catch(() => null)
    if (!target || !target.is_active) redirect('/employees')
    subject = { ...target, employee_type: target.employee_type as typeof employee.employee_type }
    targetSalaried = target.salaried
    onBehalf = { employeeId: target.id, actorName: employee.name }
  }

  const periods = getPeriodsSince(subject.hire_date)
  // Keep the pay period you were on when switching between employees (?period=YYYY-MM-DD).
  const initialPeriodIdx = Math.max(0, periods.findIndex(p => p.start === periodParam))
  const current = periods[initialPeriodIdx]
  // Someone else's timesheet opens READ-ONLY and is never created just by looking; your own loads (and is created) as always.
  const [view, expenses, salary, closedRanges, customTags, people] = await Promise.all([
    onBehalf ? viewTimesheet(subject.id, current.start) : getOrCreateTimesheet(current.start, current.end),
    getExpensesForPeriod(subject.id, current.start, current.end),
    onBehalf ? Promise.resolve(null) : getMySalary(), // on behalf of someone: never load their pay
    getActiveClosedRanges(),
    getTagList(),
    canActOnBehalf(employee) ? getTimesheetPeople() : Promise.resolve([]),
  ])

  return (
    <TimesheetClient
      key={subject.id}
      selfId={employee.id}
      people={people}
      canEditClosed={employee.is_super_admin || REOPEN_OVERRIDE_ROLES.includes(employee.role)}
      initialPeriodIdx={initialPeriodIdx}
      employeeId={subject.id}
      employeeName={subject.name}
      employeeNumber={subject.employee_number}
      employeeType={subject.employee_type}
      yearEnd={subject.year_end_holiday}
      salaried={onBehalf ? !!targetSalaried : salary !== null}
      onBehalf={onBehalf}
      periods={periods}
      initialTimesheet={view.timesheet}
      initialRows={view.rows}
      initialAudit={view.audit}
      initialExpenses={expenses}
      salary={salary}
      closedRanges={closedRanges}
      customTags={customTags}
    />
  )
}
