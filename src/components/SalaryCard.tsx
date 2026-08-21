const currency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

type Salary = { annual_salary: number; effective_date: string; note: string | null } | null

export default function SalaryCard({ salary }: { salary: Salary }) {
  return (
    <div className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-5">
      <h2 className="text-[14px] font-bold text-[#0b2b35] mb-1">Salary</h2>
      <p className="text-[11px] text-gray-400 mb-4">Only visible to you and accounting managers/CEO/admin</p>
      {salary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Annual Salary</span>
            <span className="text-[14px] text-[#0b2b35]">{currency(salary.annual_salary)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Effective</span>
            <span className="text-[14px] text-[#0b2b35]">{salary.effective_date}</span>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-gray-400">No salary on file yet.</p>
      )}
    </div>
  )
}
