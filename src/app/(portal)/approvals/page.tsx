'use client'

import { useState } from 'react'
import { MOCK_PENDING_APPROVALS } from '@/lib/mock-data'

type Decision = { verdict: 'approved' | 'denied'; reason?: string; at: string }
type ApprovalItem = typeof MOCK_PENDING_APPROVALS[number]

const TYPE_STYLE: Record<string, { bar: string; badge: string }> = {
  PTO:         { bar: 'bg-[#02ACC0]', badge: 'bg-[#e0f5f8] text-[#028a9e]'   },
  Sick:        { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700'  },
  Personal:    { bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700'    },
  Bereavement: { bar: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600'   },
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function daysUntil(iso: string) {
  const diff = Math.round((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000)
  if (diff < 0)  return null
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff} days`
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

function ApprovalCard({
  item,
  decision,
  onDecide,
}: {
  item: ApprovalItem
  decision?: Decision
  onDecide: (id: string, verdict: 'approved' | 'denied', reason?: string) => void
}) {
  const [confirming, setConfirming] = useState<'approve' | 'deny' | null>(null)
  const [denyReason, setDenyReason] = useState('')

  const tc       = TYPE_STYLE[item.type] || TYPE_STYLE.Bereavement
  const until    = daysUntil(item.start)
  const capPct   = Math.min(Math.round((item.balance_after / 400) * 100), 100)
  const dateRange = item.start === item.end
    ? fmtDate(item.start)
    : `${fmtDate(item.start)} – ${fmtDate(item.end)}`
  const isPersonalOrBereavementType = item.type === 'Personal' || item.type === 'Bereavement'

  function submitApprove() {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    onDecide(item.id, 'approved')
    setConfirming(null)
    void now
  }

  function submitDeny() {
    onDecide(item.id, 'denied', denyReason || undefined)
    setConfirming(null)
    setDenyReason('')
  }

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${
      decision ? 'opacity-60 border-[#e8f4f7]' : 'border-[#d4eef2] shadow-sm'
    }`}>
      {/* Color bar */}
      <div className={`h-1 ${tc.bar}`} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
              style={{ background: item.avatarColor }}>
              {item.avatar}
            </div>
            <div>
              <p className="font-bold text-[15px] text-[#0b2b35] leading-tight">{item.employee}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{item.type}</span>
                <span className="text-[11px] text-gray-400">Submitted {daysAgo(item.submitted)}</span>
                {until && !decision && (
                  <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">
                    Starts {until}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Decision badge or action buttons */}
          {decision ? (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold flex-shrink-0 ${
              decision.verdict === 'approved'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}>
              <span>{decision.verdict === 'approved' ? '✓' : '✕'}</span>
              <span className="capitalize">{decision.verdict}</span>
            </div>
          ) : confirming ? null : (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setConfirming('deny')}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                Deny
              </button>
              <button
                onClick={() => setConfirming('approve')}
                className="text-[12px] font-semibold px-4 py-1.5 rounded-lg bg-[#02ACC0] text-white hover:bg-[#028a9e] transition-colors">
                ✓ Approve
              </button>
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="sm:col-span-2 bg-[#f8fcfd] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Date Range</p>
            <p className="text-[14px] font-semibold text-[#0b2b35]">{dateRange}</p>
            <p className="text-[12px] text-gray-400 mt-0.5">{item.hours} hours requested</p>
          </div>
          <div className="bg-[#f8fcfd] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Balance After</p>
            {isPersonalOrBereavementType ? (
              <p className="text-[14px] font-semibold text-[#0b2b35]">No change</p>
            ) : (
              <>
                <p className={`text-[14px] font-semibold ${item.balance_after < 0 ? 'text-red-600' : 'text-[#0b2b35]'}`}>
                  {item.balance_after} hrs
                </p>
                <div className="mt-1.5 bg-[#e8f4f7] rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-[#02ACC0] rounded-full" style={{ width: `${capPct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{capPct}% of 400 hr cap</p>
              </>
            )}
          </div>
        </div>

        {/* Note */}
        {item.note && (
          <div className="flex gap-2.5 mb-4">
            <div className="w-0.5 bg-[#d4eef2] rounded-full flex-shrink-0" />
            <p className="text-[13px] text-gray-500 italic">&ldquo;{item.note}&rdquo;</p>
          </div>
        )}

        {/* Signature */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-[#f8fcfd] rounded-lg px-3 py-2">
          <span>✍</span>
          <span>Signed by <strong className="text-[#0b2b35]">{item.employee}</strong> · {item.signed_at}</span>
        </div>

        {/* Inline confirm: approve */}
        {confirming === 'approve' && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-emerald-800 mb-1">Confirm approval</p>
            <p className="text-[12px] text-emerald-700 mb-3">
              By confirming, you digitally sign this approval as <strong>Nico Sanders, President/CEO</strong> on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={submitApprove}
                className="bg-emerald-600 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
                ✓ Confirm &amp; Sign
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Inline confirm: deny */}
        {confirming === 'deny' && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-red-800 mb-1">Deny this request</p>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              placeholder="Optional: add a reason for the employee…"
              rows={2}
              className="w-full text-[12px] border border-red-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-red-400 bg-white resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={submitDeny}
                className="bg-red-500 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                ✕ Confirm Denial
              </button>
              <button
                onClick={() => { setConfirming(null); setDenyReason('') }}
                className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Decision metadata */}
        {decision && (
          <div className="mt-3 text-[11px] text-gray-400">
            {decision.verdict === 'approved'
              ? 'Approved by Nico Sanders · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : `Denied${decision.reason ? ` — "${decision.reason}"` : ''}`}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')

  function onDecide(id: string, verdict: 'approved' | 'denied', reason?: string) {
    setDecisions(d => ({ ...d, [id]: { verdict, reason, at: new Date().toISOString() } }))
  }

  const pending  = MOCK_PENDING_APPROVALS.filter(a => !decisions[a.id])
  const reviewed = MOCK_PENDING_APPROVALS.filter(a =>  decisions[a.id])

  const totalHoursPending = pending.reduce((s, a) => s + a.hours, 0)
  const oldest = pending.reduce<string | null>((min, a) => (!min || a.submitted < min ? a.submitted : min), null)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Approvals</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Nico Sanders · President &amp; CEO · June 30, 2026</p>
        </div>
        {pending.length > 0 && (
          <div className="flex gap-4 text-right flex-wrap">
            <div>
              <p className="text-[22px] font-black text-[#0b2b35] leading-none">{pending.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Pending</p>
            </div>
            <div>
              <p className="text-[22px] font-black text-amber-500 leading-none">{totalHoursPending}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Hours</p>
            </div>
            {oldest && (
              <div>
                <p className="text-[22px] font-black text-[#0b2b35] leading-none">{daysAgo(oldest)}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">Oldest</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1 w-fit mb-6">
        {([['pending', `Pending (${pending.length})`], ['reviewed', `Reviewed (${reviewed.length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              tab === key ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <>
          {pending.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-14 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-semibold text-[#0b2b35] text-[15px]">All caught up</p>
              <p className="text-[13px] text-gray-400 mt-1">No pending approvals — check back after the next pay period.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map(a => (
                <ApprovalCard key={a.id} item={a} decision={decisions[a.id]} onDecide={onDecide} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Reviewed tab */}
      {tab === 'reviewed' && (
        <>
          {reviewed.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-14 text-center">
              <p className="text-[13px] text-gray-400">No decisions made yet this session.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewed.map(a => (
                <ApprovalCard key={a.id} item={a} decision={decisions[a.id]} onDecide={onDecide} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
