import { MOCK_REPORT_ROWS } from '@/lib/mock-data'

export default function ReportsPage() {
  const totalPtoUsed = MOCK_REPORT_ROWS.reduce((s, r) => s + r.pto_used, 0)
  const totalSickUsed = MOCK_REPORT_ROWS.reduce((s, r) => s + r.sick_used, 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Leave Reports</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Bi-weekly summary for Nico Sanders</p>
        </div>
        <button className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors flex items-center gap-2">
          ⬇ Export PDF
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'PTO Hours Used', value: totalPtoUsed, color: 'text-[#02ACC0]' },
          { label: 'Sick Hours Used', value: totalSickUsed, color: 'text-violet-600' },
          { label: 'Employees Reported', value: MOCK_REPORT_ROWS.length, color: 'text-[#0b2b35]' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[32px] font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d4eef2]">
          <h2 className="text-[14px] font-bold text-[#0b2b35]">Pay Period: Jun 15 – Jun 28, 2026</h2>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Employee', 'PTO Used', 'Sick Used', 'Personal Used', 'PTO Balance', 'Sick Balance'].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_REPORT_ROWS.map(r => (
              <tr key={r.name} className="border-b border-[#f0f7f8] last:border-0">
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-5 py-3">{r.pto_used || '—'}</td>
                <td className="px-5 py-3">{r.sick_used || '—'}</td>
                <td className="px-5 py-3">{r.personal_used || '—'}</td>
                <td className="px-5 py-3 font-semibold text-[#0b2b35]">{r.pto_bal}</td>
                <td className="px-5 py-3 font-semibold text-[#0b2b35]">{r.sick_bal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
