import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getEmployeeSummary } from '@/app/actions/employees'
import { getLeaveHistory } from '@/app/actions/leave-requests'
import { getTimesheetForEmployeePeriod } from '@/app/actions/timesheets'
import { getTagList } from '@/app/actions/tags'
import { getPeriodsSince } from '@/lib/pay-periods'
import { canViewTimesheetReports } from '@/lib/constants/salary-access'
import { canActOnBehalf } from '@/lib/constants/on-behalf'
import { formatEmployeeId } from '@/lib/constants/employee-id'
import HistoryClient from '@/components/HistoryClient'
import EmployeeTimesheetView from '@/components/EmployeeTimesheetView'
import ResignationPayoutCard from '@/components/ResignationPayoutCard'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export const dynamic = 'force-dynamic'

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentEmployee()
  if (!me || !MANAGER_ROLES.includes(me.role)) redirect('/dashboard')

  const employee = await getEmployeeSummary(id)
  const periods = getPeriodsSince(employee.hire_date)
  const current = periods[0]

  // Other people's timesheets are limited to the named payroll viewers (Nico, Carrileen, super admin).
  const showTimesheets = canViewTimesheetReports(me)
  const customTags = showTimesheets ? await getTagList() : []
  const [leaveRequests, { timesheet, rows }] = await Promise.all([
    getLeaveHistory(id),
    showTimesheets ? getTimesheetForEmployeePeriod(id, current.start, current.end) : Promise.resolve({ timesheet: null, rows: [] }),
  ])

  return (
    <div>
      <Link href="/employees" className="text-[#02ACC0] text-[13px] font-semibold hover:underline mb-4 inline-block">← Back to Employees</Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-[#02ACC0] flex items-center justify-center text-[16px] font-bold text-white flex-shrink-0">
          {employee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">{employee.name} <span className="text-[13px] text-gray-400 font-normal">{formatEmployeeId(employee.employee_number)}</span></h1>
          <p className="text-[13px] text-gray-500">{employee.job_title || '—'} · {employee.department || '—'}</p>
          <div className="flex gap-1.5 mt-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${employee.is_exempt ? 'bg-gray-100 text-gray-600' : 'bg-sky-100 text-sky-700'}`}>{employee.is_exempt ? 'Exempt' : 'Non-exempt'}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${employee.is_director ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>{employee.is_director ? 'Director' : 'Non-director'}</span>
          </div>
        </div>
        {!employee.is_active && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500 ml-auto">Inactive</span>
        )}
      </div>

      {canActOnBehalf(me) && employee.is_active && employee.id !== me.id && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-amber-900">Complete something on {employee.name.split(' ')[0]}&rsquo;s behalf</p>
            <p className="text-[12px] text-amber-800 mt-0.5">An exception to the employee submitting directly. You&rsquo;ll give a reason code and notes, it&rsquo;s logged for the audit trail, and {employee.name.split(' ')[0]} is notified.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/request?for=${id}`} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 transition-colors">Request leave for {employee.name.split(' ')[0]}</Link>
            <Link href={`/timesheet?for=${id}`} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 transition-colors">Complete timesheet</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">PTO Balance</p>
            {employee.pto_uncapped && <span title="Exempt from the year-end carryover limit" className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">∞ Uncapped</span>}
          </div>
          <p className="text-[20px] font-black text-[#0b2b35] leading-none">{employee.pto_bal} <span className="text-[12px] font-normal text-gray-400">hrs</span></p>
        </div>
        <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Sick Leave</p>
          <p className="text-[20px] font-black text-[#0b2b35] leading-none">{employee.sick_bal} <span className="text-[12px] font-normal text-gray-400">hrs</span></p>
        </div>
        <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Personal Days</p>
          <p className="text-[20px] font-black text-[#0b2b35] leading-none">{employee.personal_bal} <span className="text-[12px] font-normal text-gray-400">hrs</span></p>
        </div>
      </div>

      {employee.flex_bal > 0 && <p className="text-[12px] text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 mb-6">Flex time balance: <strong>{employee.flex_bal} hrs</strong> (earned working paid holidays)</p>}

      <ResignationPayoutCard isDirector={!!employee.is_director} ptoBalance={employee.pto_bal} />

      {showTimesheets && (
        <div className="mb-8">
          <h2 className="text-[15px] font-bold text-[#0b2b35] mb-3">Timesheets</h2>
          <EmployeeTimesheetView employeeId={id} periods={periods} initialTimesheet={timesheet} initialRows={rows} customTags={customTags} yearEnd={employee.year_end_holiday} />
        </div>
      )}

      <div>
        <HistoryClient
          initialRequests={leaveRequests}
          title={`${employee.name}'s Leave Requests`}
          subtitle="Full history of submitted requests"
          showNewRequestLink={false}
        />
      </div>
    </div>
  )
}
