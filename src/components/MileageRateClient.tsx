'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setMileageRate } from '@/app/actions/mileage-rates'

type Rate = { id: string; year: number; rate_per_mile: number; updated_at: string }

const currentYear = new Date().getFullYear()

export default function MileageRateClient({ initialRates, canEdit }: { initialRates: Rate[]; canEdit: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const rates = initialRates
  const [year, setYear] = useState(String(currentYear))
  const [rate, setRate] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSave() {
    setError('')
    try {
      await setMileageRate(Number(year), Number(rate))
      showToast(`${year} rate saved`)
      setRate('')
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'

  return (
    <div>
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ {toast}
        </div>
      )}

      {canEdit && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-6">
          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">Set / Update a Rate</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2 mb-3">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Rate per Mile ($)</label>
              <input type="number" min="0" step="0.001" value={rate} onChange={e => setRate(e.target.value)} placeholder="0.70" className={inputCls} />
            </div>
            <button onClick={handleSave} disabled={!year || !rate || isPending}
              className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Save
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Year', 'Rate per Mile', 'Last Updated'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">No rates set yet</td></tr>
            )}
            {rates.map(r => (
              <tr key={r.id} className="border-b border-[#f0f7f8] last:border-0">
                <td className="px-4 py-3 font-medium text-[#0b2b35]">{r.year}</td>
                <td className="px-4 py-3 text-gray-500">${r.rate_per_mile.toFixed(3)}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(r.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
