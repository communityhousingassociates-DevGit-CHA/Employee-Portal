'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MOCK_BALANCES } from '@/lib/mock-data'

const leaveTypes = ['PTO / Vacation', 'Sick Leave', 'Personal Day', 'Bereavement', 'Jury Duty']

export default function RequestPage() {
  const router = useRouter()
  const [form, setForm] = useState({ type: 'PTO / Vacation', start: '', end: '', hours: '', note: '' })
  const [signed, setSigned] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const remaining = MOCK_BALANCES.pto.available - Number(form.hours || 0)

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#0b2b35] mb-2">Request Submitted</h2>
          <p className="text-gray-500 text-sm mb-6">Nico Sanders will be notified by email to review and approve.</p>
          <button onClick={() => router.push('/history')}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
            View My Requests
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">Request Leave</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Requests are sent to Nico Sanders for approval</p>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden max-w-2xl">
        <div className="px-5 py-4 border-b border-[#d4eef2]">
          <h2 className="text-[14px] font-bold text-[#0b2b35]">Leave Request Form</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Leave Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]">
                {leaveTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Total Hours Requested</label>
              <input
                type="number" min="1" step="0.5" placeholder="e.g. 8"
                value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
              <span className="text-[11px] text-gray-400">Leave is taken in hourly increments</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Start Date</label>
              <input type="date" value={form.start}
                onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
                className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">End Date</label>
              <input type="date" value={form.end}
                onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
                className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Note to Approver (optional)</label>
              <textarea
                rows={3} placeholder="Add any context for Nico..."
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0] resize-none" />
            </div>
          </div>

          {/* Balance preview */}
          {form.hours && (
            <div className="bg-[#e8f7f9] rounded-lg p-4 mt-5 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-gray-500">Current PTO</p>
                <p className="font-bold text-[#0b2b35]">{MOCK_BALANCES.pto.available} hrs</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">This Request</p>
                <p className="font-bold text-red-500">− {form.hours} hrs</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Remaining</p>
                <p className={`font-bold ${remaining < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{remaining.toFixed(1)} hrs</p>
              </div>
            </div>
          )}

          {/* Digital signature */}
          <div className="mt-6 border-2 border-dashed border-[#d4eef2] rounded-xl p-6 text-center bg-[#f9fefe]">
            <p className="text-[13px] font-bold text-[#0b2b35] mb-1">Employee Digital Signature</p>
            <p className="text-[12px] text-gray-400 mb-4">By signing, you confirm this request is accurate and requires approval before leave is taken.</p>
            <div
              onClick={() => setSigned(true)}
              className={`border-b-2 border-[#0b2b35] mx-auto max-w-[260px] h-12 flex items-end justify-center pb-1 cursor-pointer
                font-[cursive] text-xl text-[#0b2b35] transition-colors ${signed ? 'border-[#02ACC0]' : 'hover:border-[#02ACC0]'}`}>
              {signed ? 'Maria Edwards' : <span className="text-gray-300 text-sm font-sans">Click to sign</span>}
            </div>
            {signed && <p className="text-[11px] text-gray-400 mt-2">Maria Edwards · Jun 29, 2026 · 9:14 AM</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              disabled={!signed || !form.hours || !form.start}
              onClick={() => setSubmitted(true)}
              className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Submit Request
            </button>
            <button onClick={() => history.back()}
              className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
