import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getEmployeeSummary } from '@/app/actions/employees'
import { getLeaveHistory } from '@/app/actions/leave-requests'
import { getTimesheetForEmployeePeriod } from '@/app/actions/timesheets'
import { getPeriodsSince } from '@/lib/pay-periods'
import { formatEmployeeId } from '@/lib/constants/employee-id'
import HistoryClient from '@/components/HistoryClient'
import EmployeeTimesheetView from '@/components/EmployeeTimesheetView'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export const dynamic = 'force-dynamic'

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentEmployee()
  if (!me || !MANAGER_ROLES.includes(me.role)) redirect('/dashboard')

  const employee = await getEmployeeSummary(id)
  const periods = getPeriodsSince(employee.hire_date)
  const current = periods[0]

  const [leaveRequests, { timesheet, rows }] = await Promise.all([
    getLeaveHistory(id),
    getTimesheetForEmployeePeriod(id, current.start, current.end),
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
        </div>
        {!employee.is_active && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500 ml-auto">Archived</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">PTO Balance</p>
          <p className="text-[20px] font-black text-[#0b2b35] leading-none">{employee.pto_bal} <span className="text-[12px] font-normal text-gray-400">hrs</span></p>
        </div>
        <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Sick Leave</p>
          <p className="text-[20px] font-black text-[#0b2b35] leading-none">{employee.sick_bal} <span className="text-[12px] font-normal text-gray-400">hrs</span></p>
        </div>
        <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Personal</p>
          <p className="text-[20px] font-black text-[#0b2b35] leading-none">{employee.personal_bal} <span className="text-[12px] font-normal text-gray-400">hrs</span></p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-[15px] font-bold text-[#0b2b35] mb-3">Timesheets</h2>
        <EmployeeTimesheetView employeeId={id} periods={periods} initialTimesheet={timesheet} initialRows={rows} />
      </div>

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
