import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import DashboardGreeting from '@/components/DashboardGreeting'
import WeatherBadge from '@/components/WeatherBadge'
import TimesheetAlertBell from '@/components/TimesheetAlertBell'
import { getMyBalance, getMyRecentRequests, getNextApprovedLeave, getPendingLeaveApprovals, getMyLeaveOutlook } from '@/app/actions/leave-requests'
import { getOrCreateTimesheet, getTimesheetReminderStatus, getPendingTimesheetApprovals } from '@/app/actions/timesheets'
import { getPendingExpenseApprovals } from '@/app/actions/expenses'
import { getCurrentPeriod } from '@/lib/pay-periods'
import { fmtDateShort as fmtDate, fmtDaySet } from '@/lib/format-date'
import { getBaltimoreWeather } from '@/lib/weather'
import { fmtHrs } from '@/lib/format-hours'

const TYPE_COLOR: Record<string, { bar: string; badge: string }> = {
  PTO: { bar: 'bg-[#02ACC0]', badge: 'bg-[#e0f5f8] text-[#028a9e]' },
  Sick: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
  Personal: { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  Bereavement: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  'Jury Duty': { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  Voting: { bar: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700' },
  'Workers Comp': { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' },
  Military: { bar: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
  Unpaid: { bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
  'Flex Time': { bar: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700' },
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export default async function DashboardPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const isManager = MANAGER_ROLES.includes(employee.role)
  const initials = employee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const period = getCurrentPeriod()
  const [balance, recent, nextLeave, { timesheet, rows }, pendingApprovals, weather, timesheetReminder, pendingExpenses, pendingTimesheets, outlook] = await Promise.all([
    getMyBalance(),
    getMyRecentRequests(4),
    getNextApprovedLeave(),
    getOrCreateTimesheet(period.start, period.end),
    isManager ? getPendingLeaveApprovals() : Promise.resolve([]),
    getBaltimoreWeather(),
    getTimesheetReminderStatus(),
    isManager ? getPendingExpenseApprovals() : Promise.resolve([]),
    isManager ? getPendingTimesheetApprovals() : Promise.resolve([]),
    getMyLeaveOutlook(),
  ])

  const pendingCount = pendingApprovals.length + pendingExpenses.length + pendingTimesheets.length
  const pendingBreakdown = [
    pendingApprovals.length > 0 && `${pendingApprovals.length} leave`,
    pendingExpenses.length > 0 && `${pendingExpenses.length} expense${pendingExpenses.length > 1 ? 's' : ''}`,
    pendingTimesheets.length > 0 && `${pendingTimesheets.length} timesheet${pendingTimesheets.length > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ')
  const pendingDates = [
    ...pendingApprovals.map(a => a.created_at),
    ...pendingExpenses.map(e => e.created_at),
    ...pendingTimesheets.flatMap(t => (t.employee_signed_at ? [t.employee_signed_at] : [])),
  ]
  const oldestPending = pendingDates.reduce<string | null>((min, d) => (!min || d < min ? d : min), null)

  const now = new Date()
  const periodStart = new Date(`${period.start}T00:00:00`)
  const periodEnd = new Date(`${period.end}T00:00:00`)
  const periodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1
  const daysPast = Math.min(Math.max(Math.round((now.getTime() - periodStart.getTime()) / 86400000) + 1, 1), periodDays)
  const periodPct = Math.round((daysPast / periodDays) * 100)

  const ptoHours = balance ? Number(balance.pto_hours) : 0
  const sickHours = balance ? Number(balance.sick_hours) : 0
  const personalHours = balance ? Number(balance.personal_hours) : 0
  const flexHours = balance ? Number(balance.flex_hours ?? 0) : 0

  const tsTotalReg = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
  const tsTotalLeave = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
  const tsTotalHoliday = rows.reduce((s, r) => s + Number(r.holiday_hours ?? 0), 0)
  const tsTotal = tsTotalReg + tsTotalLeave + tsTotalHoliday
  const tsTarget = 80
  const tsPct = Math.min(Math.round((tsTotal / tsTarget) * 100), 100)
  const tsRemaining = Math.max(tsTarget - tsTotal, 0)

  const tiles = [
    { href: '/request', icon: '🌴', title: 'Request/Use Leave', desc: `${fmtHrs(ptoHours)} PTO hrs available`, color: 'bg-[#02ACC0]' },
    { href: '/timesheet', icon: '🕑', title: 'My Timesheet', desc: `${tsTotal} of ${tsTarget} hrs logged`, color: 'bg-amber-500' },
    { href: '/expenses', icon: '🧾', title: 'My Expenses', desc: 'Submit or track reimbursements', color: 'bg-rose-500' },
    { href: '/calendar', icon: '📅', title: 'Team Calendar', desc: "See who's out this week", color: 'bg-violet-500' },
    ...(isManager ? [{ href: '/approvals', icon: '✅', title: 'Approvals', desc: `${pendingCount} item${pendingCount === 1 ? '' : 's'} waiting on you`, color: 'bg-emerald-600' }] : []),
  ]

  return (
    <div className="space-y-6">
      {!employee.year_end_holiday && employee.employee_type === 'full-time' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-sky-800"><strong>Choose your year-end holiday.</strong> CHA gives you either Christmas Eve or New Year&apos;s Eve as a paid holiday.</p>
          <Link href="/profile#year-end-holiday" className="bg-sky-600 text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-sky-700 transition-colors flex-shrink-0">Choose →</Link>
        </div>
      )}
      {isManager && pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-[13px] flex-shrink-0">{pendingCount}</div>
            <div>
              <p className="text-[13px] font-semibold text-amber-800">{pendingCount} item{pendingCount > 1 ? 's' : ''} awaiting your approval <span className="font-normal text-amber-700">({pendingBreakdown})</span></p>
              {oldestPending && <p className="text-[11px] text-amber-600 mt-0.5">Oldest submitted {daysAgo(oldestPending)} · review before pay period ends</p>}
            </div>
          </div>
          <Link href="/approvals" className="bg-amber-500 text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-600 transition-colors flex-shrink-0">Review Now →</Link>
        </div>
      )}

      {/* Greeting + pay period progress, weather/alerts/quick actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <DashboardGreeting firstName={employee.name.split(' ')[0] || 'there'} />
          <div className="flex items-center gap-3 mt-3">
            <div className="w-36 h-1.5 bg-[#e8f4f7] rounded-full overflow-hidden">
              <div className="h-full bg-[#02ACC0] rounded-full transition-all" style={{ width: `${periodPct}%` }} />
            </div>
            <p className="text-[11px] text-gray-400">Pay period {fmtDate(period.start)} – {fmtDate(period.end)} · day {daysPast} of {periodDays}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WeatherBadge weather={weather} />
          <TimesheetAlertBell active={!!timesheetReminder} reminder={timesheetReminder ? { due: timesheetReminder.due, daysUntil: timesheetReminder.daysUntil } : null} />
          <Link href="/calendar" className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-[#d4eef2] text-[#0b2b35] hover:bg-[#f0f7f8] transition-colors">Calendar</Link>
          <Link href="/request" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">+ Request/Use Leave</Link>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-[#0b2b35] rounded-2xl px-6 py-6 flex flex-wrap items-center gap-5">
        {employee.avatar_url ? (
          <Image src={employee.avatar_url} alt={employee.name} width={64} height={64} className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-white/20" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#02ACC0] flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0">{initials}</div>
        )}
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-white text-[20px] font-bold">{employee.name}</h2>
          <p className="text-white/50 text-[13px] capitalize">{employee.job_title || employee.role.replace('_', ' ')} · {employee.department || 'Community Housing Associates'}</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'PTO', v: `${fmtHrs(ptoHours)}h` },
            { label: 'Sick', v: `${fmtHrs(sickHours)}h` },
            { label: 'Personal Days', v: `${Math.floor(personalHours / 8)}d` },
            ...(flexHours > 0 ? [{ label: 'Flex', v: `${fmtHrs(flexHours)}h` }] : []),
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-lg px-3.5 py-2 text-center min-w-[72px]">
              <p className="text-white text-[16px] font-bold leading-none">{s.v}</p>
              <p className="text-white/50 text-[10px] uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {outlook.reservedDetail.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
          <div className="flex items-start gap-3">
            <span className="text-[18px]">🔖</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#0b2b35]">Reserved for approved future leave</p>
              <p className="text-[12px] text-gray-500 mt-0.5">
                This leave is planned more than two pay periods out, so it&apos;s reserved rather than deducted yet. It comes off your balance once it&apos;s within two pay periods of its start date. Your <strong>projected</strong> balance must actually be available on that day for the leave to be valid.
                {!outlook.accrualsOn && ' Accruals aren’t switched on yet, so no future accruals are counted.'}
              </p>
              <ul className="mt-3 space-y-2">
                {outlook.reservedDetail.map(r => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px] bg-[#f8fcfd] rounded-lg px-3 py-2">
                    <span className="text-[#0b2b35] font-semibold">{r.leave_type === 'Personal' ? 'Personal Days' : r.leave_type} · {r.hours} hrs · {r.days && r.days.length > 0 ? fmtDaySet(r.days.map((d: { date: string }) => d.date), true) : `starts ${fmtDate(r.start_date)}`}</span>
                    <span className={r.covered ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {r.covered ? '✓' : '⚠'} Projected {fmtHrs(r.projectedBefore)} hrs available then{r.covered ? '' : ' — not enough'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Bold color tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(t => (
          <Link key={t.href} href={t.href} className={`${t.color} rounded-xl p-5 text-white hover:opacity-90 transition-opacity relative overflow-hidden group`}>
            <span className="text-[26px]">{t.icon}</span>
            <h3 className="text-[15px] font-bold uppercase tracking-wide mt-3">{t.title}</h3>
            <p className="text-[12px] text-white/80 mt-1 leading-snug">{t.desc}</p>
            <span className="text-[11px] font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all">VIEW <span>→</span></span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4eef2]">
            <h2 className="text-[14px] font-bold text-[#0b2b35]">Recent Leave Requests</h2>
            <Link href="/history" className="text-[12px] font-semibold text-[#02ACC0] hover:underline">View All →</Link>
          </div>
          <div className="divide-y divide-[#f0f7f8]">
            {recent.length === 0 && <p className="px-5 py-6 text-[13px] text-gray-400">No requests yet.</p>}
            {recent.map(r => {
              const tc = TYPE_COLOR[r.leave_type] || TYPE_COLOR.PTO
              const dateRange = r.days && r.days.length > 0 ? fmtDaySet(r.days.map((d: { date: string }) => d.date), true) : (r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}`)
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${tc.bar}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{r.leave_type}</span>
                      <span className="text-[12px] text-gray-400">{dateRange}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{r.hours} hrs · submitted {daysAgo(r.created_at)}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-[#f0f7f8] bg-[#fafefe]">
            <Link href="/request" className="text-[12px] font-semibold text-[#02ACC0] hover:underline">+ Submit a new request</Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4eef2]">
              <h2 className="text-[13px] font-bold text-[#0b2b35] flex items-center gap-1.5">
                Timesheet
                {timesheet.status === 'draft' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />}
              </h2>
              <Link href="/timesheet" className="text-[11px] font-semibold text-[#02ACC0] hover:underline">Open →</Link>
            </div>
            <div className="px-4 py-4">
              <p className="text-[11px] text-gray-400 mb-0.5">{fmtDate(period.start)} – {fmtDate(period.end)}</p>
              <div className="flex items-end gap-1.5 mb-2">
                <span className="text-[22px] font-black text-[#0b2b35]">{tsTotal}</span>
                <span className="text-[12px] text-gray-400 mb-1">/ {tsTarget} hrs</span>
              </div>
              <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-2">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${tsPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[timesheet.status] ?? 'bg-gray-100 text-gray-500'}`}>{timesheet.status}</span>
                <span className="text-[11px] text-gray-400">{tsRemaining} hrs remaining</span>
              </div>
            </div>
          </div>

          {nextLeave ? (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Upcoming Leave</p>
              <p className="text-[#0b2b35] font-semibold text-[14px]">{nextLeave.leave_type}</p>
              <p className="text-gray-500 text-[12px] mt-0.5">
                {nextLeave.days && nextLeave.days.length > 0 ? fmtDaySet(nextLeave.days.map((d: { date: string }) => d.date), true) : `${fmtDate(nextLeave.start_date)}${nextLeave.start_date !== nextLeave.end_date ? ` – ${fmtDate(nextLeave.end_date)}` : ''}`} · {nextLeave.hours} hrs
              </p>
              <div className="mt-3 pt-3 border-t border-[#f0f7f8] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[11px] text-emerald-600 font-semibold">Approved</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Upcoming Leave</p>
              <p className="text-[13px] text-gray-400">No approved leave scheduled.</p>
              <Link href="/request" className="text-[12px] font-semibold text-[#02ACC0] mt-2 inline-block hover:underline">Plan time off →</Link>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#d4eef2]">
              <p className="text-[12px] font-bold text-[#0b2b35]">Documentation & Help</p>
            </div>
            <div className="divide-y divide-[#f0f7f8]">
              {[
                { href: '/guide', label: 'How-To Guide', icon: '📘' },
                { href: '/sop', label: 'Staff SOP', icon: '📄' },
                ...(isManager ? [{ href: '/sop/admin', label: 'Admin & Leadership SOP', icon: '📋' }] : []),
                { href: '/report-issue', label: 'Report an Issue', icon: '🆘' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8fcfd] transition-colors">
                  <span className="text-[14px]">{item.icon}</span>
                  <span className="text-[12px] font-medium text-[#0b2b35]">{item.label}</span>
                  <span className="ml-auto text-gray-300 text-[11px]">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
