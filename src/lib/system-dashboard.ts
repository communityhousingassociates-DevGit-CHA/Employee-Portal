// Read-side queries for the super-admin System dashboard (/admin/system). Server-only; every caller must already have checked
// is_super_admin. Test accounts are left out of every metric so rehearsals never skew the numbers. Not a 'use server' file.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getTestAccountIds } from '@/lib/test-accounts'
import { getPeriodsSince, getTimesheetDueDate, todayET } from '@/lib/pay-periods'

const DAY = 86400000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()
const ageDays = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : null)
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

type Admin = SupabaseClient

async function people(admin: Admin) {
  const { data } = await admin.from('employees').select('id, name, email, is_active, is_test_account, hire_date')
  const rows = (data ?? []) as { id: string; name: string; email: string; is_active: boolean; is_test_account: boolean; hire_date: string }[]
  return { rows, byId: new Map(rows.map(r => [r.id, r])), testIds: new Set(rows.filter(r => r.is_test_account).map(r => r.id)) }
}

// ───────────────────────────── Issues ─────────────────────────────

export type IssueStats = {
  open: number; reviewed: number; fixed: number; total: number
  oldestOpenDays: number | null; avgDaysToFix: number | null
  byCategory: { category: string; count: number }[]
  byWeek: { week: string; count: number }[]
  topPages: { page: string; count: number }[]
  recent: { id: string; created_at: string; category: string; status: string; reporter: string; description: string; page_url: string | null; fixed_at: string | null }[]
}

export async function loadIssueStats(admin: Admin): Promise<IssueStats> {
  const { data } = await admin.from('issue_reports')
    .select('id, created_at, category, status, description, page_url, fixed_at, employee:employees!issue_reports_employee_id_fkey(name)')
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as unknown as { id: string; created_at: string; category: string; status: string; description: string; page_url: string | null; fixed_at: string | null; employee: { name: string } | { name: string }[] | null }[]
  const count = (s: string) => rows.filter(r => r.status === s).length
  const notFixed = rows.filter(r => r.status !== 'fixed')
  const fixed = rows.filter(r => r.status === 'fixed' && r.fixed_at)
  const tally = (keyOf: (r: (typeof rows)[number]) => string | null) => {
    const m = new Map<string, number>()
    for (const r of rows) { const k = keyOf(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const weekStart = (iso: string) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10) }
  const weeks = new Map<string, number>()
  for (const r of rows) if (Date.parse(r.created_at) > Date.now() - 84 * DAY) weeks.set(weekStart(r.created_at), (weeks.get(weekStart(r.created_at)) ?? 0) + 1)
  return {
    open: count('open'), reviewed: count('reviewed'), fixed: count('fixed'), total: rows.length,
    oldestOpenDays: notFixed.length ? Math.max(...notFixed.map(r => ageDays(r.created_at) ?? 0)) : null,
    avgDaysToFix: fixed.length ? Math.round((fixed.reduce((s, r) => s + (Date.parse(r.fixed_at!) - Date.parse(r.created_at)), 0) / fixed.length / DAY) * 10) / 10 : null,
    byCategory: tally(r => r.category).map(([category, count]) => ({ category, count })),
    byWeek: [...weeks.entries()].sort().map(([week, count]) => ({ week, count })),
    topPages: tally(r => (r.page_url ? r.page_url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] || '/' : null)).slice(0, 5).map(([page, count]) => ({ page, count })),
    recent: rows.slice(0, 15).map(r => ({ id: r.id, created_at: r.created_at, category: r.category, status: r.status, reporter: one(r.employee)?.name ?? 'Unknown', description: r.description, page_url: r.page_url, fixed_at: r.fixed_at })),
  }
}

// ───────────────────────────── Audit log ─────────────────────────────

export type AuditItem = { at: string; source: 'Timesheet' | 'Leave' | 'Expense' | 'Pay period' | 'Import'; action: string; actor: string; subject: string; reason: string | null; note: string | null; detail: string | null; exception: boolean }
export type AuditFilter = { days: number; type: 'all' | 'timesheet' | 'leave' | 'expense' | 'admin'; exceptionsOnly: boolean; includeTest: boolean }

const TS_EXCEPTIONS = new Set(['manual_edit', 'submitted_on_behalf', 'edited_on_behalf', 'override_reopened', 'reopened', 'returned'])
const fmtChanges = (c: unknown) => Array.isArray(c) ? (c as { date: string; field: string; from: string; to: string }[]).map(x => `${x.date} ${x.field}: ${x.from} → ${x.to}`).join('; ') : null

export async function loadAuditLog(admin: Admin, f: AuditFilter): Promise<AuditItem[]> {
  const since = daysAgo(f.days)
  const { byId, testIds } = await people(admin)
  const name = (id: string | null | undefined) => (id ? byId.get(id)?.name ?? 'Unknown' : '—')
  const want = (t: AuditFilter['type'], k: AuditFilter['type']) => t === 'all' || t === k
  const items: AuditItem[] = []
  const hidden = (employeeId: string | null | undefined) => !f.includeTest && !!employeeId && testIds.has(employeeId)

  const jobs: PromiseLike<void>[] = []
  if (want(f.type, 'timesheet')) jobs.push(admin.from('timesheet_events')
    .select('action, actor_id, reason_code, note, changes, created_at, ts:timesheets(employee_id, period_start, period_end)')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(1500)
    .then(({ data }) => {
      for (const e of (data ?? []) as unknown as { action: string; actor_id: string; reason_code: string | null; note: string | null; changes: unknown; created_at: string; ts: { employee_id: string; period_start: string; period_end: string } | { employee_id: string; period_start: string; period_end: string }[] | null }[]) {
        const t = one(e.ts); if (hidden(t?.employee_id)) continue
        items.push({ at: e.created_at, source: 'Timesheet', action: e.action.replace(/_/g, ' '), actor: name(e.actor_id), subject: name(t?.employee_id), reason: e.reason_code, note: e.note, detail: [t ? `${t.period_start} – ${t.period_end}` : null, fmtChanges(e.changes)].filter(Boolean).join(' · ') || null, exception: TS_EXCEPTIONS.has(e.action) })
      }
    }))
  if (want(f.type, 'leave')) jobs.push(admin.from('leave_request_events')
    .select('action, actor_name, reason_code, note, created_at, req:leave_requests(employee_id, leave_type, start_date, end_date)')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(1500)
    .then(({ data }) => {
      for (const e of (data ?? []) as unknown as { action: string; actor_name: string | null; reason_code: string | null; note: string | null; created_at: string; req: { employee_id: string; leave_type: string; start_date: string; end_date: string } | { employee_id: string; leave_type: string; start_date: string; end_date: string }[] | null }[]) {
        const r = one(e.req); if (hidden(r?.employee_id)) continue
        items.push({ at: e.created_at, source: 'Leave', action: e.action.replace(/_/g, ' '), actor: e.actor_name ?? '—', subject: name(r?.employee_id), reason: e.reason_code, note: e.note, detail: r ? `${r.leave_type} ${r.start_date}${r.end_date !== r.start_date ? ` – ${r.end_date}` : ''}` : null, exception: !!e.reason_code || /on_behalf/.test(e.action) })
      }
    }))
  if (want(f.type, 'expense')) jobs.push(admin.from('expense_events')
    .select('action, actor_name, reason_code, note, created_at, exp:expenses(employee_id)')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(1500)
    .then(({ data }) => {
      for (const e of (data ?? []) as unknown as { action: string; actor_name: string | null; reason_code: string | null; note: string | null; created_at: string; exp: { employee_id: string } | { employee_id: string }[] | null }[]) {
        const x = one(e.exp); if (hidden(x?.employee_id)) continue
        items.push({ at: e.created_at, source: 'Expense', action: e.action.replace(/_/g, ' '), actor: e.actor_name ?? '—', subject: name(x?.employee_id), reason: e.reason_code, note: e.note, detail: null, exception: !!e.reason_code || /on_behalf/.test(e.action) })
      }
    }))
  if (want(f.type, 'admin')) {
    jobs.push(admin.from('closed_periods').select('start_date, end_date, note, closed_by, closed_at, lifted_at, lifted_by, lift_note').or(`closed_at.gte.${since},lifted_at.gte.${since}`)
      .then(({ data }) => {
        for (const c of (data ?? []) as { start_date: string; end_date: string; note: string | null; closed_by: string | null; closed_at: string; lifted_at: string | null; lifted_by: string | null; lift_note: string | null }[]) {
          const range = `${c.start_date} – ${c.end_date}`
          if (c.closed_at >= since) items.push({ at: c.closed_at, source: 'Pay period', action: 'closed', actor: name(c.closed_by), subject: '—', reason: null, note: c.note, detail: range, exception: false })
          if (c.lifted_at && c.lifted_at >= since) items.push({ at: c.lifted_at, source: 'Pay period', action: 'reopened', actor: name(c.lifted_by), subject: '—', reason: null, note: c.lift_note, detail: range, exception: true })
        }
      }))
    jobs.push(admin.from('import_batches').select('status, prepared_by, committed_by, committed_at, employee_rows, balance_rows, salary_rows, created_at').gte('created_at', since)
      .then(({ data }) => {
        for (const b of (data ?? []) as { status: string; prepared_by: string | null; committed_by: string | null; committed_at: string | null; employee_rows: number | null; balance_rows: number | null; salary_rows: number | null; created_at: string }[]) {
          const rows = `${b.employee_rows ?? 0} employee, ${b.balance_rows ?? 0} balance, ${b.salary_rows ?? 0} salary rows`
          items.push({ at: b.created_at, source: 'Import', action: 'prepared', actor: name(b.prepared_by), subject: '—', reason: null, note: null, detail: rows, exception: false })
          if (b.committed_at) items.push({ at: b.committed_at, source: 'Import', action: 'committed', actor: name(b.committed_by), subject: '—', reason: null, note: null, detail: rows, exception: true })
        }
      }))
  }
  await Promise.all(jobs)
  return items.filter(i => !f.exceptionsOnly || i.exception).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 600)
}

export function auditCsv(items: AuditItem[]): string {
  const q = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  return ['When,Area,Action,By,Employee,Reason,Notes,Detail,Exception', ...items.map(i => [q(i.at), q(i.source), q(i.action), q(i.actor), q(i.subject), q(i.reason), q(i.note), q(i.detail), i.exception ? 'yes' : ''].join(','))].join('\n')
}

// ───────────────────────────── Releases ─────────────────────────────

export type Release = { sha: string; message: string; author: string | null; branch: string | null; deployed_at: string }
export async function loadReleases(admin: Admin, limit = 150): Promise<Release[]> {
  const { data } = await admin.from('release_log').select('sha, message, author, branch, deployed_at').order('deployed_at', { ascending: false }).limit(limit)
  return (data ?? []) as Release[]
}

// ───────────────────────────── Errors ─────────────────────────────

export type ErrorGroup = { kind: string; message: string; route: string | null; count: number; last: string }
export async function loadErrors(admin: Admin, days = 7) {
  const { data } = await admin.from('app_errors').select('id, created_at, kind, message, path, route, route_type').gte('created_at', daysAgo(days)).order('created_at', { ascending: false }).limit(2000)
  const rows = (data ?? []) as { id: string; created_at: string; kind: string; message: string; path: string | null; route: string | null; route_type: string | null }[]
  const groups = new Map<string, ErrorGroup>()
  for (const r of rows) {
    const k = `${r.kind}|${r.message}|${r.route}`
    const g = groups.get(k)
    if (g) g.count++
    else groups.set(k, { kind: r.kind, message: r.message, route: r.route, count: 1, last: r.created_at })
  }
  return {
    groups: [...groups.values()].sort((a, b) => (a.kind === b.kind ? b.count - a.count : a.kind === 'server_error' ? -1 : 1)),
    serverErrors24h: rows.filter(r => r.kind === 'server_error' && Date.parse(r.created_at) > Date.now() - DAY).length,
    blocked24h: rows.filter(r => r.kind === 'user_blocked' && Date.parse(r.created_at) > Date.now() - DAY).length,
    recent: rows.slice(0, 25),
  }
}

// ───────────────────────────── Health (jobs, email, access) ─────────────────────────────

export async function loadHealth(admin: Admin) {
  const { rows, testIds } = await people(admin)
  const [runs, failedEmails, emailTotals, blocks, authUsers] = await Promise.all([
    admin.from('job_runs').select('job, started_at, ok, summary').order('started_at', { ascending: false }).limit(60),
    admin.from('email_log').select('created_at, kind, recipient_email, subject, error').eq('status', 'failed').gte('created_at', daysAgo(7)).order('created_at', { ascending: false }).limit(25),
    admin.from('email_log').select('status').gte('created_at', daysAgo(7)).limit(5000),
    admin.from('geofence_blocks').select('employee_id, city, region, created_at').gte('created_at', daysAgo(7)).order('created_at', { ascending: false }).limit(200),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ])
  const jobRows = (runs.data ?? []) as { job: string; started_at: string; ok: boolean; summary: string | null }[]
  const latestByJob = new Map<string, (typeof jobRows)[number]>()
  for (const r of jobRows) if (!latestByJob.has(r.job)) latestByJob.set(r.job, r)
  const emailStatuses = (emailTotals.data ?? []) as { status: string }[]

  const active = rows.filter(r => r.is_active && !r.is_test_account)
  const authByEmail = new Map((authUsers.data?.users ?? []).map(u => [u.email?.toLowerCase() ?? '', u]))
  const neverSignedIn = active.filter(p => { const u = authByEmail.get(p.email.toLowerCase()); return !u || !u.last_sign_in_at })
  const blockRows = ((blocks.data ?? []) as { employee_id: string | null; city: string | null; region: string | null; created_at: string }[]).filter(b => !b.employee_id || !testIds.has(b.employee_id))

  return {
    jobs: [...latestByJob.values()],
    jobFailures: jobRows.filter(r => !r.ok).slice(0, 8),
    emailFailed: (failedEmails.data ?? []) as { created_at: string; kind: string | null; recipient_email: string; subject: string; error: string | null }[],
    emailSent7d: emailStatuses.filter(e => e.status === 'sent').length,
    emailFailed7d: emailStatuses.filter(e => e.status === 'failed').length,
    geofenceBlocks7d: blockRows.length,
    neverSignedIn: neverSignedIn.map(p => p.name),
  }
}

// ───────────────────────────── Overview metrics ─────────────────────────────

export async function loadOverview(admin: Admin) {
  const testIds = await getTestAccountIds(admin)
  const notTest = <Q extends { not: (c: string, o: string, v: string) => Q }>(q: Q) => (testIds.size ? q.not('employee_id', 'in', `(${[...testIds].join(',')})`) : q)
  const today = todayET()
  const periods = getPeriodsSince('2026-09-13')
  const lastDue = periods.find(p => getTimesheetDueDate(p) < today) ?? null

  const [{ rows }, issues, errors, health, tsAll, events30, pendLeave, pendExp, pendTs] = await Promise.all([
    people(admin),
    loadIssueStats(admin),
    loadErrors(admin),
    loadHealth(admin),
    lastDue ? admin.from('timesheets').select('employee_id, status').eq('period_start', lastDue.start) : Promise.resolve({ data: [] as { employee_id: string; status: string }[] }),
    admin.from('timesheet_events').select('action, ts:timesheets(employee_id)').in('action', ['submitted_on_behalf', 'edited_on_behalf', 'manual_edit']).gte('created_at', daysAgo(30)).limit(5000),
    notTest(admin.from('leave_requests').select('created_at').eq('status', 'pending').order('created_at').limit(1)),
    notTest(admin.from('expenses').select('created_at').eq('status', 'pending').order('created_at').limit(1)),
    notTest(admin.from('timesheets').select('employee_signed_at').eq('status', 'submitted').order('employee_signed_at').limit(1)),
  ])

  const eligible = lastDue ? rows.filter(r => r.is_active && !r.is_test_account && r.hire_date <= lastDue.end) : []
  const doneIds = new Set(((tsAll.data ?? []) as { employee_id: string; status: string }[]).filter(t => t.status !== 'draft').map(t => t.employee_id))
  const submitted = eligible.filter(e => doneIds.has(e.id)).length
  const real30 = ((events30.data ?? []) as unknown as { action: string; ts: { employee_id: string } | { employee_id: string }[] | null }[]).filter(e => { const id = one(e.ts)?.employee_id; return !id || !testIds.has(id) })
  const oldest = (r: { data: { [k: string]: string }[] | null }, key: string) => ageDays(r.data?.[0]?.[key])

  return {
    issues, errors, health,
    compliance: lastDue ? { period: `${lastDue.start} – ${lastDue.end}`, submitted, total: eligible.length, missing: eligible.filter(e => !doneIds.has(e.id)).map(e => e.name) } : null,
    onBehalf30: real30.filter(e => e.action !== 'manual_edit').length, manual30: real30.filter(e => e.action === 'manual_edit').length,
    oldestPending: { leave: oldest(pendLeave as never, 'created_at'), expenses: oldest(pendExp as never, 'created_at'), timesheets: oldest(pendTs as never, 'employee_signed_at') },
  }
}
