import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadOverview, loadIssueStats, loadAuditLog, loadReleases, loadErrors, loadHealth, type AuditFilter } from '@/lib/system-dashboard'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'issues', label: 'Issues' },
  { key: 'audit', label: 'Audit log' },
  { key: 'releases', label: 'Releases' },
  { key: 'health', label: 'System health' },
  { key: 'errors', label: 'Errors' },
] as const
type Tab = (typeof TABS)[number]['key']

const ts = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const card = 'bg-white rounded-xl border border-[#d4eef2] p-5'
const th = 'text-left text-[10px] uppercase tracking-wide text-gray-400 font-semibold px-3 py-2'
const td = 'px-3 py-2 text-[12px] text-[#0b2b35] align-top border-t border-[#f0f7f8]'

function Stat({ label, value, sub, tone = 'ok' }: { label: string; value: string | number; sub?: string; tone?: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const color = { ok: 'text-[#02ACC0]', warn: 'text-amber-500', bad: 'text-red-500', muted: 'text-gray-400' }[tone]
  return (
    <div className={card}>
      <div className={`text-[26px] font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-gray-400 py-6 text-center">{children}</p>

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ tab?: string; days?: string; type?: string; exceptions?: string; test?: string }> }) {
  const employee = await getCurrentEmployee()
  if (!employee?.is_super_admin) redirect('/admin')
  const sp = await searchParams
  const tab: Tab = (TABS.find(t => t.key === sp.tab)?.key ?? 'overview') as Tab
  const admin = createAdminClient()

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">System</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Issues, changes, releases and health of the portal. Visible to the super admin only; test accounts are left out of every number.</p>
      </div>
      <div className="flex gap-1 flex-wrap mb-6 border-b border-[#d4eef2]">
        {TABS.map(t => (
          <Link key={t.key} href={`/admin/system?tab=${t.key}`}
            className={`text-[13px] font-semibold px-4 py-2 -mb-px border-b-2 ${tab === t.key ? 'border-[#02ACC0] text-[#02ACC0]' : 'border-transparent text-gray-500 hover:text-[#0b2b35]'}`}>{t.label}</Link>
        ))}
      </div>
      {tab === 'overview' && <Overview admin={admin} />}
      {tab === 'issues' && <Issues admin={admin} />}
      {tab === 'audit' && <Audit admin={admin} sp={sp} />}
      {tab === 'releases' && <Releases admin={admin} />}
      {tab === 'health' && <Health admin={admin} />}
      {tab === 'errors' && <Errors admin={admin} />}
    </div>
  )
}

type A = { admin: ReturnType<typeof createAdminClient> }

async function Overview({ admin }: A) {
  const o = await loadOverview(admin)
  const attention: { text: string; href: string }[] = []
  if (o.issues.open) attention.push({ text: `${o.issues.open} open issue report${o.issues.open === 1 ? '' : 's'}${o.issues.oldestOpenDays ? ` — oldest ${o.issues.oldestOpenDays} day${o.issues.oldestOpenDays === 1 ? '' : 's'}` : ''}`, href: '/admin/system?tab=issues' })
  if (o.compliance && o.compliance.missing.length) attention.push({ text: `${o.compliance.missing.length} timesheet${o.compliance.missing.length === 1 ? '' : 's'} not submitted for ${o.compliance.period}: ${o.compliance.missing.join(', ')}`, href: '/approvals' })
  if (o.health.jobFailures.length) attention.push({ text: `A scheduled job reported a problem (${o.health.jobFailures[0].summary ?? 'see System health'})`, href: '/admin/system?tab=health' })
  if (o.health.emailFailed7d) attention.push({ text: `${o.health.emailFailed7d} email${o.health.emailFailed7d === 1 ? '' : 's'} failed to send in the last 7 days`, href: '/admin/system?tab=health' })
  if (o.errors.serverErrors24h) attention.push({ text: `${o.errors.serverErrors24h} server error${o.errors.serverErrors24h === 1 ? '' : 's'} in the last 24 hours`, href: '/admin/system?tab=errors' })
  if (o.health.neverSignedIn.length) attention.push({ text: `${o.health.neverSignedIn.length} active account${o.health.neverSignedIn.length === 1 ? ' has' : 's have'} never signed in: ${o.health.neverSignedIn.join(', ')}`, href: '/admin/system?tab=health' })

  const pct = o.compliance && o.compliance.total ? Math.round((o.compliance.submitted / o.compliance.total) * 100) : null
  const age = (n: number | null) => (n === null ? 'none waiting' : `${n} day${n === 1 ? '' : 's'}`)
  return (
    <div className="space-y-6">
      <div className={`${card} ${attention.length ? 'border-amber-200 bg-amber-50' : ''}`}>
        <h2 className="text-[13px] font-bold text-[#0b2b35] uppercase tracking-wide mb-2">{attention.length ? 'Needs attention' : 'All clear'}</h2>
        {attention.length === 0 ? <p className="text-[13px] text-gray-500">Nothing needs attention right now.</p> : (
          <ul className="space-y-1.5">{attention.map(a => <li key={a.text} className="text-[13px] text-amber-900"><Link href={a.href} className="hover:underline">• {a.text}</Link></li>)}</ul>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Open issues" value={o.issues.open} sub={`${o.issues.reviewed} reviewed · ${o.issues.fixed} fixed`} tone={o.issues.open ? 'warn' : 'ok'} />
        <Stat label="Timesheets submitted" value={pct === null ? '—' : `${pct}%`} sub={o.compliance ? `${o.compliance.submitted} of ${o.compliance.total} for ${o.compliance.period}` : undefined} tone={pct !== null && pct < 100 ? 'warn' : 'ok'} />
        <Stat label="On-behalf submits (30d)" value={o.onBehalf30} sub="Exceptions to self-submission" tone={o.onBehalf30 > 5 ? 'warn' : 'ok'} />
        <Stat label="Manual edits (30d)" value={o.manual30} sub="Override / Edit saves" tone={o.manual30 > 10 ? 'warn' : 'ok'} />
        <Stat label="Oldest pending leave" value={age(o.oldestPending.leave)} tone="muted" />
        <Stat label="Oldest pending expense" value={age(o.oldestPending.expenses)} tone="muted" />
        <Stat label="Oldest timesheet awaiting approval" value={age(o.oldestPending.timesheets)} tone="muted" />
        <Stat label="Server errors (24h)" value={o.errors.serverErrors24h} sub={`${o.errors.blocked24h} blocked actions shown to users`} tone={o.errors.serverErrors24h ? 'bad' : 'ok'} />
        <Stat label="Emails failed (7d)" value={o.health.emailFailed7d} sub={`${o.health.emailSent7d} sent`} tone={o.health.emailFailed7d ? 'bad' : 'ok'} />
        <Stat label="Location blocks (7d)" value={o.health.geofenceBlocks7d} sub="Sign-ins refused by the location rule" tone={o.health.geofenceBlocks7d ? 'warn' : 'ok'} />
        <Stat label="Never signed in" value={o.health.neverSignedIn.length} sub="Active accounts" tone={o.health.neverSignedIn.length ? 'warn' : 'ok'} />
      </div>
    </div>
  )
}

async function Issues({ admin }: A) {
  const s = await loadIssueStats(admin)
  const max = Math.max(1, ...s.byWeek.map(w => w.count))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Open" value={s.open} tone={s.open ? 'warn' : 'ok'} />
        <Stat label="Reviewed" value={s.reviewed} tone="muted" />
        <Stat label="Fixed" value={s.fixed} />
        <Stat label="Avg days to fix" value={s.avgDaysToFix ?? '—'} sub={s.oldestOpenDays !== null ? `Oldest unfixed: ${s.oldestOpenDays} days` : 'Nothing unfixed'} tone="muted" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className={card}>
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35] mb-3">By category</h3>
          {s.byCategory.length === 0 ? <Empty>No reports yet.</Empty> : s.byCategory.map(c => <div key={c.category} className="flex justify-between text-[13px] py-1"><span>{c.category.replace(/_/g, ' ')}</span><strong>{c.count}</strong></div>)}
        </div>
        <div className={card}>
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35] mb-3">Reports per week (12 weeks)</h3>
          {s.byWeek.length === 0 ? <Empty>No recent reports.</Empty> : s.byWeek.map(w => (
            <div key={w.week} className="flex items-center gap-2 text-[12px] py-0.5"><span className="w-20 text-gray-400">{w.week}</span><div className="h-2 bg-[#02ACC0] rounded" style={{ width: `${(w.count / max) * 100}%`, minWidth: 6 }} /><span>{w.count}</span></div>
          ))}
        </div>
        <div className={card}>
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35] mb-3">Pages with the most reports</h3>
          {s.topPages.length === 0 ? <Empty>No page data yet.</Empty> : s.topPages.map(p => <div key={p.page} className="flex justify-between text-[13px] py-1 gap-3"><span className="truncate">{p.page}</span><strong>{p.count}</strong></div>)}
        </div>
      </div>
      <div className={`${card} p-0 overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3"><h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35]">Latest reports</h3><Link href="/issues" className="text-[12px] font-semibold text-[#02ACC0]">Open Issue Reports →</Link></div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={th}>When</th><th className={th}>Reporter</th><th className={th}>Category</th><th className={th}>Status</th><th className={th}>Description</th></tr></thead><tbody>
          {s.recent.length === 0 && <tr><td className={td} colSpan={5}><Empty>No issue reports.</Empty></td></tr>}
          {s.recent.map(r => <tr key={r.id}><td className={`${td} whitespace-nowrap`}>{ts(r.created_at)}</td><td className={td}>{r.reporter}</td><td className={td}>{r.category.replace(/_/g, ' ')}</td><td className={td}>{r.status}</td><td className={td}>{r.description.slice(0, 140)}{r.description.length > 140 ? '…' : ''}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  )
}

async function Audit({ admin, sp }: A & { sp: { days?: string; type?: string; exceptions?: string; test?: string } }) {
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30
  const type = (['all', 'timesheet', 'leave', 'expense', 'admin'].includes(sp.type ?? '') ? sp.type : 'all') as AuditFilter['type']
  const f: AuditFilter = { days, type, exceptionsOnly: sp.exceptions === '1', includeTest: sp.test === '1' }
  const items = await loadAuditLog(admin, f)
  const qs = new URLSearchParams({ days: String(days), type, ...(f.exceptionsOnly ? { exceptions: '1' } : {}), ...(f.includeTest ? { test: '1' } : {}) }).toString()
  const sel = 'text-[13px] border border-[#d4eef2] rounded-lg px-2 py-1 bg-white'
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="tab" value="audit" />
        <select name="type" defaultValue={type} className={sel}><option value="all">All areas</option><option value="timesheet">Timesheets</option><option value="leave">Leave</option><option value="expense">Expenses</option><option value="admin">Pay periods &amp; imports</option></select>
        <select name="days" defaultValue={String(days)} className={sel}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select>
        <label className="text-[13px] flex items-center gap-1.5"><input type="checkbox" name="exceptions" value="1" defaultChecked={f.exceptionsOnly} /> Exceptions only</label>
        <label className="text-[13px] flex items-center gap-1.5"><input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} /> Include test accounts</label>
        <button className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-1.5 rounded-lg">Apply</button>
        <a href={`/admin/system/export?${qs}`} className="text-[13px] font-semibold text-[#02ACC0] ml-auto">⬇ Download CSV</a>
      </form>
      <p className="text-[12px] text-gray-400">{items.length} entr{items.length === 1 ? 'y' : 'ies'}{items.length >= 600 ? ' (showing the newest 600 — narrow the filters or download the CSV)' : ''}. “Exceptions” are manual edits, on-behalf entries, returns, reopenings and committed imports.</p>
      <div className={`${card} p-0 overflow-x-auto`}><table className="w-full"><thead><tr><th className={th}>When</th><th className={th}>Area</th><th className={th}>Action</th><th className={th}>By</th><th className={th}>Employee</th><th className={th}>Why / detail</th></tr></thead><tbody>
        {items.length === 0 && <tr><td className={td} colSpan={6}><Empty>Nothing recorded for these filters.</Empty></td></tr>}
        {items.map((i, n) => (
          <tr key={n} className={i.exception ? 'bg-amber-50/60' : ''}>
            <td className={`${td} whitespace-nowrap`}>{ts(i.at)}</td><td className={td}>{i.source}</td>
            <td className={`${td} font-semibold`}>{i.action}{i.exception && <span className="ml-1.5 text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full">exception</span>}</td>
            <td className={td}>{i.actor}</td><td className={td}>{i.subject}</td>
            <td className={td}>{[i.reason?.replace(/_/g, ' '), i.note, i.detail].filter(Boolean).join(' — ') || '—'}</td>
          </tr>
        ))}
      </tbody></table></div>
    </div>
  )
}

async function Releases({ admin }: A) {
  const releases = await loadReleases(admin)
  const badge = (m: string) => { const t = /^(\w+)(\(.+?\))?!?:/.exec(m)?.[1]; return t && ['feat', 'fix', 'chore', 'refactor', 'docs', 'perf', 'test'].includes(t) ? t : null }
  const color: Record<string, string> = { feat: 'bg-emerald-100 text-emerald-800', fix: 'bg-red-100 text-red-800', perf: 'bg-sky-100 text-sky-800' }
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-400">Every production deploy, newest first. Entries are recorded automatically at build time, starting from this release; earlier history was backfilled from the commit log.</p>
      <div className={`${card} p-0 overflow-x-auto`}><table className="w-full"><thead><tr><th className={th}>Deployed</th><th className={th}>Change</th><th className={th}>By</th><th className={th}>Commit</th></tr></thead><tbody>
        {releases.length === 0 && <tr><td className={td} colSpan={4}><Empty>No releases recorded yet.</Empty></td></tr>}
        {releases.map(r => { const b = badge(r.message); const first = r.message.split('\n')[0]; return (
          <tr key={r.sha}><td className={`${td} whitespace-nowrap`}>{ts(r.deployed_at)}</td>
            <td className={td}>{b && <span className={`mr-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color[b] ?? 'bg-gray-100 text-gray-600'}`}>{b}</span>}{first.replace(/^\w+(\(.+?\))?!?:\s*/, '')}</td>
            <td className={td}>{r.author ?? '—'}</td><td className={`${td} font-mono`}>{r.sha.slice(0, 7)}</td></tr>
        ) })}
      </tbody></table></div>
    </div>
  )
}

async function Health({ admin }: A) {
  const h = await loadHealth(admin)
  return (
    <div className="space-y-6">
      <div className={card}>
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35] mb-3">Scheduled jobs</h3>
        {h.jobs.length === 0 ? <Empty>No runs recorded yet. The daily job records itself each morning (about 8am ET).</Empty> : h.jobs.map(j => (
          <div key={j.job} className="flex items-center justify-between gap-3 py-1.5 text-[13px] border-t first:border-t-0 border-[#f0f7f8]">
            <span><strong>{j.job}</strong> <span className="text-gray-400">· last run {ts(j.started_at)}</span></span>
            <span className={j.ok ? 'text-emerald-600' : 'text-red-500'}>{j.ok ? '✓ ' : '⚠ '}{j.summary}</span>
          </div>
        ))}
        {h.jobFailures.length > 0 && <div className="mt-3 text-[12px] text-gray-500"><p className="font-semibold mb-1">Recent problems</p>{h.jobFailures.map(f => <p key={f.started_at}>{ts(f.started_at)} — {f.summary}</p>)}</div>}
      </div>
      <div className={card}>
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35] mb-3">Email delivery (7 days): {h.emailSent7d} sent, {h.emailFailed7d} failed</h3>
        {h.emailFailed.length === 0 ? <Empty>No failed sends.</Empty> : <table className="w-full"><tbody>{h.emailFailed.map((e, n) => <tr key={n}><td className={`${td} whitespace-nowrap`}>{ts(e.created_at)}</td><td className={td}>{e.recipient_email}</td><td className={td}>{e.subject}</td><td className={`${td} text-red-500`}>{e.error ?? 'failed'}</td></tr>)}</tbody></table>}
      </div>
      <div className={card}><h3 className="text-[12px] font-bold uppercase tracking-wide text-[#0b2b35] mb-2">Never signed in ({h.neverSignedIn.length})</h3>{h.neverSignedIn.length === 0 ? <Empty>Everyone active has signed in.</Empty> : <p className="text-[13px]">{h.neverSignedIn.join(', ')}</p>}</div>
      <p className="text-[12px] text-gray-400">Location-rule blocks in the last 7 days: <strong>{h.geofenceBlocks7d}</strong> (details are in the daily tracking email).</p>
    </div>
  )
}

async function Errors({ admin }: A) {
  const e = await loadErrors(admin)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Server errors (24h)" value={e.serverErrors24h} tone={e.serverErrors24h ? 'bad' : 'ok'} />
        <Stat label="Blocked actions shown to users (24h)" value={e.blocked24h} sub="e.g. a refused submit with an on-screen message" tone="muted" />
      </div>
      <p className="text-[12px] text-gray-400">Last 7 days, grouped. Recorded from the app&rsquo;s own server code, so a person who sees “can&rsquo;t submit” leaves a trace here even if they never report it. Problems outside the app (a deploy failing, the host being down) show in Vercel instead.</p>
      <div className={`${card} p-0 overflow-x-auto`}><table className="w-full"><thead><tr><th className={th}>Type</th><th className={th}>Message</th><th className={th}>Where</th><th className={th}>Count</th><th className={th}>Last seen</th></tr></thead><tbody>
        {e.groups.length === 0 && <tr><td className={td} colSpan={5}><Empty>No errors recorded in the last 7 days. (Recording began with this release.)</Empty></td></tr>}
        {e.groups.map((g, n) => <tr key={n}><td className={`${td} whitespace-nowrap ${g.kind === 'server_error' ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>{g.kind === 'server_error' ? 'Server error' : 'Blocked action'}</td><td className={td}>{g.message}</td><td className={`${td} font-mono`}>{g.route ?? '—'}</td><td className={td}>{g.count}</td><td className={`${td} whitespace-nowrap`}>{ts(g.last)}</td></tr>)}
      </tbody></table></div>
    </div>
  )
}
