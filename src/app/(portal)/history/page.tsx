import Link from 'next/link'
import { MOCK_REQUESTS } from '@/lib/mock-data'

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
}

export default function HistoryPage() {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">My Leave Requests</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Full history of submitted requests</p>
        </div>
        <Link href="/request"
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + New Request
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Type', 'Dates', 'Hours', 'Submitted', 'Approved By', 'Status'].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_REQUESTS.map(r => (
              <tr key={r.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-5 py-3">{r.type}</td>
                <td className="px-5 py-3">{r.start === r.end ? r.start : `${r.start} – ${r.end}`}</td>
                <td className="px-5 py-3">{r.hours}</td>
                <td className="px-5 py-3">{r.submitted}</td>
                <td className="px-5 py-3">{r.approved_by ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusStyle[r.status]}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
