import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import DashboardGreeting from '@/components/DashboardGreeting'
import WeatherBadge from '@/components/WeatherBadge'
import TimesheetAlertBell from '@/components/TimesheetAlertBell'
import { getMyBalance, getMyRecentRequests, getNextApprovedLeave, getPendingLeaveApprovals, getMyLeaveOutlook } from '@/app/actions/leave-requests'
import { getOrCreateTimesheet, getTimesheetReminderStatus, getPendingTimesheetApprovals } from '@/app/actions/timesheets'
import { getPendingExpenseApprovals } from '@/app/actions/expenses'
import { getCurrentPeriod, todayET } from '@/lib/pay-periods'
import { fmtDateShort as fmtDate, fmtDaySet } from '@/lib/format-date'
import { getBaltimoreWeather } from '@/lib/weather'
import { fmtHrs } from '@/lib/format-hours'
import '@/components/dashboard/dashboard.css'
import DxIcon from '@/components/dashboard/icons'

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

  const periodStart = new Date(`${period.start}T00:00:00`)
  const periodEnd = new Date(`${period.end}T00:00:00`)
  const periodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1
  const daysPast = Math.min(Math.max(Math.round((new Date(`${todayET()}T00:00:00`).getTime() - periodStart.getTime()) / 86400000) + 1, 1), periodDays)
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

  // CHA's tile colors, kept as-is; they now color the icon chip on each card.
  const tiles = [
    { href: '/request', icon: 'leave', title: 'Request/Use Leave', desc: `${fmtHrs(ptoHours)} PTO hrs available`, color: '#02ACC0' },
    { href: '/timesheet', icon: 'timesheet', title: 'My Timesheet', desc: `${tsTotal} of ${tsTarget} hrs logged`, color: '#F59E0B' },
    { href: '/expenses', icon: 'expenses', title: 'My Expenses', desc: 'Submit or track reimbursements', color: '#F43F5E' },
    { href: '/calendar', icon: 'calendar', title: 'Team Calendar', desc: "See who's out this week", color: '#8B5CF6' },
    ...(isManager ? [{ href: '/approvals', icon: 'approvals', title: 'Approvals', desc: `${pendingCount} item${pendingCount === 1 ? '' : 's'} waiting on you`, color: '#059669' }] : []),
  ]
  const pill = (st: string) => (st === 'approved' ? 'dx-ok' : st === 'pending' ? 'dx-wait' : st === 'denied' ? 'dx-bad' : 'dx-draft')

  return (
    <div className="dx dx-wrap">
      {!employee.year_end_holiday && employee.employee_type === 'full-time' && (
        <div className="dx-card dx-note">
          <p><strong className="dx-strong">Choose your year-end holiday.</strong> CHA gives you either Christmas Eve or New Year&apos;s Eve as a paid holiday.</p>
          <Link href="/profile#year-end-holiday" className="dx-btn dx-btn--p">Choose</Link>
        </div>
      )}

      {isManager && pendingCount > 0 && (
        <section className="dx-card dx-attn">
          <div className="dx-cnt">{pendingCount}</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dx-ink)' }}>{pendingCount} item{pendingCount > 1 ? 's are' : ' is'} waiting on your approval</div>
            <div style={{ fontSize: 12.5, color: 'var(--dx-muted)', marginTop: 2 }}>{pendingBreakdown}{oldestPending ? ` · oldest submitted ${daysAgo(oldestPending).toLowerCase()}` : ''} · review before the pay period ends</div>
          </div>
          <Link href="/approvals" className="dx-btn">Review now →</Link>
        </section>
      )}

      <div className="dx-head">
        <div>
          <DashboardGreeting firstName={employee.name.split(' ')[0] || 'there'} />
          <div className="dx-period">
            <span className="dx-meter"><b style={{ width: `${periodPct}%` }} /></span>
            <span>Pay period {fmtDate(period.start)} – {fmtDate(period.end)} · day {daysPast} of {periodDays}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <WeatherBadge weather={weather} />
          <TimesheetAlertBell active={!!timesheetReminder} reminder={timesheetReminder ? { due: timesheetReminder.due, daysUntil: timesheetReminder.daysUntil } : null} />
          <Link href="/calendar" className="dx-btn">Team calendar</Link>
          <Link href="/request" className="dx-btn dx-btn--p">Request leave</Link>
        </div>
      </div>

      <div className="dx-profile">
        <div className="dx-ini" aria-hidden="true">{initials}</div>
        <div>
          <div className="dx-pname">{employee.name}</div>
          <div className="dx-prole">{employee.job_title || employee.role.replace('_', ' ')} · {employee.department || 'Community Housing Associates'}</div>
        </div>
        <div className="dx-stats">
          {[
            { label: 'PTO', v: `${fmtHrs(ptoHours)}h` },
            { label: 'Sick', v: `${fmtHrs(sickHours)}h` },
            { label: 'Personal days', v: `${Math.floor(personalHours / 8)}d` },
            ...(flexHours > 0 ? [{ label: 'Flex', v: `${fmtHrs(flexHours)}h` }] : []),
          ].map(s => (
            <div key={s.label} className="dx-stat"><b>{s.v}</b><span>{s.label}</span></div>
          ))}
        </div>
      </div>

      {outlook.reservedDetail.length > 0 && (
        <section className="dx-card dx-pad">
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--dx-ink)' }}>Reserved for approved future leave</p>
          <p style={{ fontSize: 12.5, color: 'var(--dx-muted)', marginTop: 4 }}>
            This leave is planned more than two pay periods out, so it&apos;s reserved rather than deducted yet. It comes off your balance once it&apos;s within two pay periods of its start date. Your <strong>projected</strong> balance must actually be available on that day for the leave to be valid.
            {!outlook.accrualsOn && ' Accruals aren’t switched on yet, so no future accruals are counted.'}
          </p>
          <ul style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outlook.reservedDetail.map(r => (
              <li key={r.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 12.5, background: 'var(--dx-sub)', borderRadius: 8, padding: '8px 12px' }}>
                <span className="dx-strong">{r.leave_type === 'Personal' ? 'Personal Days' : r.leave_type} · {r.hours} hrs · {r.days && r.days.length > 0 ? fmtDaySet(r.days.map((d: { date: string }) => d.date), true) : `starts ${fmtDate(r.start_date)}`}</span>
                <span style={{ fontWeight: 600, color: r.covered ? '#176b46' : '#b42318' }}>{r.covered ? '✓' : '⚠'} Projected {fmtHrs(r.projectedBefore)} hrs available then{r.covered ? '' : ', not enough'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dx-actions" style={{ ['--dx-n' as string]: tiles.length }}>
        {tiles.map(t => (
          <Link key={t.href} href={t.href} className="dx-card dx-act">
            <div className="dx-ic" style={{ backgroundColor: t.color }}><DxIcon name={t.icon} /></div>
            <div><div className="dx-at">{t.title}</div><div className="dx-ad">{t.desc}</div></div>
            <div className="dx-go">Open →</div>
          </Link>
        ))}
      </div>

      <div className="dx-row2">
        <section className="dx-card" style={{ overflow: 'hidden', alignSelf: 'start' }}>
          <div className="dx-ch"><h2>Recent leave requests</h2><Link href="/history" className="dx-link">View all</Link></div>
          {recent.length === 0 ? <p className="dx-empty">No requests yet.</p> : (
            <table className="dx-table">
              <thead><tr><th>Type</th><th>Dates</th><th className="dx-r">Hours</th><th>Submitted</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map(r => {
                  const dateRange = r.days && r.days.length > 0 ? fmtDaySet(r.days.map((d: { date: string }) => d.date), true) : (r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}`)
                  return (
                    <tr key={r.id}>
                      <td className="dx-strong">{r.leave_type}</td>
                      <td>{dateRange}</td>
                      <td className="dx-r dx-num">{Number(r.hours).toFixed(1)}</td>
                      <td>{daysAgo(r.created_at)}</td>
                      <td><span className={`dx-pill ${pill(r.status)}`}><i />{r.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--dx-line2)', background: 'var(--dx-sub)' }}><Link href="/request" className="dx-link" style={{ fontSize: 13 }}>+ Submit a new request</Link></div>
        </section>

        <div className="dx-rail">
          <section className="dx-card">
            <div className="dx-ch"><h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Current timesheet{timesheet.status === 'draft' && <span aria-label="Draft, not yet submitted" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />}</h2><Link href="/timesheet" className="dx-link">Open</Link></div>
            <div className="dx-pad" style={{ paddingTop: 0 }}>
              <div className="dx-lbl">{fmtDate(period.start)} – {fmtDate(period.end)}</div>
              <div className="dx-big" style={{ marginTop: 6 }}>{tsTotal}<small>of {tsTarget} hrs</small></div>
              <div className="dx-meter" style={{ width: '100%', margin: '14px 0 12px' }}><b style={{ width: `${tsPct}%`, background: '#F59E0B' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`dx-pill ${timesheet.status === 'approved' ? 'dx-ok' : timesheet.status === 'submitted' ? 'dx-wait' : 'dx-draft'}`}><i />{timesheet.status}</span>
                <span style={{ fontSize: 12, color: 'var(--dx-muted)' }}>{tsRemaining} hrs remaining</span>
              </div>
            </div>
          </section>
          <section className="dx-card dx-pad">
            <div className="dx-lbl">Upcoming leave</div>
            {nextLeave ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dx-ink)', marginTop: 8 }}>{nextLeave.leave_type}</div>
                <div style={{ fontSize: 13, color: 'var(--dx-muted)', marginTop: 2 }}>
                  {nextLeave.days && nextLeave.days.length > 0 ? fmtDaySet(nextLeave.days.map((d: { date: string }) => d.date), true) : `${fmtDate(nextLeave.start_date)}${nextLeave.start_date !== nextLeave.end_date ? ` – ${fmtDate(nextLeave.end_date)}` : ''}`} · {nextLeave.hours} hrs
                </div>
                <div style={{ marginTop: 12 }}><span className="dx-pill dx-ok"><i />Approved</span></div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--dx-muted)', marginTop: 8 }}>No approved leave scheduled.</p>
                <Link href="/request" className="dx-link" style={{ marginTop: 8, display: 'inline-block' }}>Plan time off →</Link>
              </>
            )}
          </section>
          <section className="dx-card dx-help" style={{ overflow: 'hidden' }}>
            <div className="dx-ch" style={{ paddingBottom: 12 }}><h2>Documentation &amp; help</h2></div>
            {[
              { href: '/guide', label: 'How-To Guide' },
              { href: '/sop', label: 'Staff SOP' },
              ...(isManager ? [{ href: '/sop/admin', label: 'Admin & Leadership SOP' }] : []),
              { href: '/report-issue', label: 'Report an issue' },
            ].map(item => (
              <Link key={item.href} href={item.href}>{item.label}<span style={{ color: 'var(--dx-faint)' }}>›</span></Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
