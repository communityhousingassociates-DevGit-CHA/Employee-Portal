'use client'

import { useState } from 'react'
import { resignationPayout } from '@/lib/resignation-payout'

export default function ResignationPayoutCard({ isDirector, ptoBalance }: { isDirector: boolean; ptoBalance: number }) {
  const [noticeDate, setNoticeDate] = useState('')
  const [lastDay, setLastDay] = useState('')
  const result = noticeDate && lastDay && lastDay >= noticeDate ? resignationPayout({ isDirector, ptoBalance, noticeDate, lastDay }) : null
  const inputCls = 'px-3 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'

  return (
    <div className="bg-white rounded-xl border border-[#d4eef2] p-5 mb-5">
      <h2 className="text-[14px] font-bold text-[#0b2b35] mb-1">Resignation payout calculator</h2>
      <p className="text-[11px] text-gray-400 mb-4">Voluntary resignation only. Uses this employee&apos;s position ({isDirector ? 'Director' : 'non-Director'}) and current annual leave (PTO) balance of {ptoBalance} hrs. Nothing is changed — this only calculates.</p>
      <div className="flex flex-wrap gap-4 mb-3">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide font-semibold text-gray-400">Notice given<input type="date" value={noticeDate} onChange={e => setNoticeDate(e.target.value)} className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide font-semibold text-gray-400">Last day (effective date)<input type="date" value={lastDay} onChange={e => setLastDay(e.target.value)} className={inputCls} /></label>
      </div>
      {result && (
        <div className={`rounded-lg px-4 py-3 text-[13px] border ${result.noticeMet ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <p className="font-bold text-[15px] mb-1">{result.payoutHours} hrs of annual leave payable</p>
          <p className="text-[12px]">{result.explanation}</p>
        </div>
      )}
    </div>
  )
}
