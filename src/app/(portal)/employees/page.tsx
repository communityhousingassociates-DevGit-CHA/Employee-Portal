'use client'

import { useState } from 'react'
import { MOCK_EMPLOYEES } from '@/lib/mock-data'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES)

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Employees</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{employees.filter(e => e.status === 'active').length} active · Manage leave balances and access</p>
        </div>
        <button className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Name', 'Type', 'Hire Date', 'Accrual Tier', 'Rate (hrs/pp)', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map(e => (
              <tr key={e.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-5 py-3 font-medium text-[#0b2b35]">{e.name}</td>
                <td className="px-5 py-3 text-gray-500">{e.type}</td>
                <td className="px-5 py-3 text-gray-500">{e.hire_date}</td>
                <td className="px-5 py-3 text-gray-500">{e.tier}</td>
                <td className="px-5 py-3 font-semibold text-[#02ACC0]">{e.accrual.toFixed(2)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                    ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button className="border border-[#d4eef2] text-[12px] font-semibold px-3 py-1 rounded-lg hover:bg-[#f0f7f8] transition-colors">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
