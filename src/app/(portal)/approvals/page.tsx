'use client'

import { useState } from 'react'
import { MOCK_PENDING_APPROVALS } from '@/lib/mock-data'

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState(MOCK_PENDING_APPROVALS)
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'denied'>>({})

  function decide(id: string, decision: 'approved' | 'denied') {
    setDecisions(d => ({ ...d, [id]: decision }))
  }

  const pending = approvals.filter(a => !decisions[a.id])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">Pending Approvals</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Logged in as Nico Sanders — President/CEO</p>
      </div>

      {pending.length === 0 && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold">All caught up — no pending approvals</p>
        </div>
      )}

      {approvals.map(a => {
        const dec = decisions[a.id]
        return (
          <div key={a.id}
            className={`bg-white rounded-xl border p-5 mb-4 transition-all ${dec ? 'opacity-50 border-[#d4eef2]' : 'border-[#d4eef2] hover:border-[#02ACC0]'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: a.avatarColor }}>
                    {a.avatar}
                  </div>
                  <div>
                    <span className="font-bold text-[14px] text-[#0b2b35]">{a.employee}</span>
                    <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded-full">{a.type} Request</span>
                  </div>
                </div>
                <div className="text-[13px] text-gray-500 leading-relaxed ml-10">
                  <strong className="text-gray-700">{a.start} – {a.end}</strong> · {a.hours} hours · Submitted {a.submitted}<br />
                  Balance after approval: <strong className="text-[#0b2b35]">{a.balance_after} hrs PTO</strong><br />
                  {a.note && <span>Note: &ldquo;{a.note}&rdquo;</span>}
                </div>
                <div className="text-[12px] text-gray-400 mt-2 ml-10">
                  <strong className="text-[#0b2b35]">Employee signature:</strong> {a.employee} · {a.signed_at}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                {dec ? (
                  <span className={`px-3 py-1 rounded-full text-[12px] font-semibold capitalize
                    ${dec === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {dec}
                  </span>
                ) : (
                  <>
                    <button onClick={() => decide(a.id, 'approved')}
                      className="bg-[#02ACC0] text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-[#028a9e] transition-colors">
                      ✓ Approve &amp; Sign
                    </button>
                    <button onClick={() => decide(a.id, 'denied')}
                      className="bg-red-500 text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-red-600 transition-colors">
                      ✕ Deny
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
