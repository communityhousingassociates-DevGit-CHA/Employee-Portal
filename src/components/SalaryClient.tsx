'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSalary, getSalaryForEmployee, bulkSetSalary } from '@/app/actions/salary'

type SalaryRow = {
  id: string
  name: string
  email: string
  current: { annual_salary: number; effective_date: string; note: string | null } | null
}

type HistoryEntry = { id: string; annual_salary: number; effective_date: string; note: string | null; created_at: string }
type BulkMode = 'set' | 'add' | 'percent'

const currency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function SalaryClient({ initialSalaries }: { initialSalaries: SalaryRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const salaries = initialSalaries
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [editTarget, setEditTarget] = useState<SalaryRow | null>(null)
  const [form, setForm] = useState({ annual_salary: '', effective_date: '', note: '' })
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulk, setShowBulk] = useState(false)
  const [bulkForm, setBulkForm] = useState({ mode: 'percent' as BulkMode, value: '', effective_date: new Date().toISOString().slice(0, 10), note: '' })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')

  function toggleSelected(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(s => s.size === salaries.length ? new Set() : new Set(salaries.map(r => r.id)))
  }

  function computeBulkAmount(row: SalaryRow): number | null {
    const value = Number(bulkForm.value)
    if (!value && bulkForm.mode !== 'set') return null
    if (bulkForm.mode === 'set') return value
    const current = row.current?.annual_salary
    if (current === undefined || current === null) return null
    if (bulkForm.mode === 'add') return current + value
    return Math.round(current * (1 + value / 100) * 100) / 100
  }

  async function handleBulkSave() {
    setBulkError('')
    const updates: { employee_id: string; annual_salary: number }[] = []
    const skipped: string[] = []
    for (const row of salaries.filter(r => selected.has(r.id))) {
      const amount = computeBulkAmount(row)
      if (amount === null) { skipped.push(row.name); continue }
      updates.push({ employee_id: row.id, annual_salary: amount })
    }
    if (updates.length === 0) {
      setBulkError('No eligible employees to update — for %/add mode, selected employees need an existing current salary.')
      return
    }
    setBulkSaving(true)
    try {
      await bulkSetSalary(updates, bulkForm.effective_date, bulkForm.note)
      showToast(`Updated ${updates.length} salaries${skipped.length ? ` (skipped ${skipped.length} with no current salary)` : ''}`)
      setShowBulk(false)
      setSelected(new Set())
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setBulkError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBulkSaving(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function toggleHistory(row: SalaryRow) {
    if (expandedId === row.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(row.id)
    if (!history[row.id]) {
      setLoadingHistory(true)
      try {
        const rows = await getSalaryForEmployee(row.id)
        setHistory(h => ({ ...h, [row.id]: rows }))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load history')
      } finally {
        setLoadingHistory(false)
      }
    }
  }

  function openEdit(row: SalaryRow) {
    setEditTarget(row)
    setForm({ annual_salary: '', effective_date: new Date().toISOString().slice(0, 10), note: '' })
    setError('')
  }

  async function handleSave() {
    if (!editTarget) return
    setError('')
    try {
      await setSalary(editTarget.id, {
        annual_salary: Number(form.annual_salary),
        effective_date: form.effective_date,
        note: form.note,
      })
      showToast('Salary change saved')
      setEditTarget(null)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Salary</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Restricted — visible to accounting managers, CEO, and admins only</p>
        </div>
        {selected.size > 0 && (
          <button onClick={() => { setShowBulk(true); setBulkError(''); setBulkForm(f => ({ ...f, value: '' })) }}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
            Bulk Update Selected ({selected.size})
          </button>
        )}
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ {toast}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[700px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              <th className="text-left px-4 py-2.5 w-8">
                <input type="checkbox" checked={selected.size === salaries.length && salaries.length > 0} onChange={toggleSelectAll} />
              </th>
              {['Name', 'Email', 'Current Salary', 'Effective', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salaries.map(row => (
              <Fragment key={row.id}>
                <tr className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                  <td className="px-4 py-3 font-medium text-[#0b2b35]">{row.name}</td>
                  <td className="px-4 py-3 text-gray-400">{row.email}</td>
                  <td className="px-4 py-3 text-gray-500">{row.current ? currency(row.current.annual_salary) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{row.current?.effective_date || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleHistory(row)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] hover:bg-[#f0f7f8]">
                        {expandedId === row.id ? 'Hide History' : 'History'}
                      </button>
                      <button onClick={() => openEdit(row)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#02ACC0] text-[#02ACC0] hover:bg-[#f0f7f8]">
                        + Salary Change
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr className="border-b border-[#f0f7f8]">
                    <td colSpan={6} className="px-4 py-3 bg-[#f8fcfd]">
                      {loadingHistory && !history[row.id] ? (
                        <span className="text-gray-400 text-[12px]">Loading…</span>
                      ) : (history[row.id]?.length ?? 0) === 0 ? (
                        <span className="text-gray-400 text-[12px]">No salary history recorded</span>
                      ) : (
                        <table className="w-full text-[12px]">
                          <tbody>
                            {history[row.id].map(h => (
                              <tr key={h.id}>
                                <td className="py-1 pr-4 text-gray-500">{h.effective_date}</td>
                                <td className="py-1 pr-4 font-medium text-[#0b2b35]">{currency(h.annual_salary)}</td>
                                <td className="py-1 text-gray-400">{h.note || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">Salary Change — {editTarget.name}</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2">{error}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Annual Salary</label>
                <input type="number" min="0" step="0.01" value={form.annual_salary}
                  onChange={e => setForm(f => ({ ...f, annual_salary: e.target.value }))}
                  placeholder="65000" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Effective Date</label>
                <input type="date" value={form.effective_date}
                  onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} className={inputCls} />
                <span className="text-[11px] text-gray-400">A future date won&apos;t take effect until it arrives</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Note</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Annual raise, Promotion" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={!form.annual_salary || !form.effective_date || isPending}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Save
              </button>
              <button onClick={() => setEditTarget(null)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">Bulk Salary Update — {selected.size} employees</h2>
              <button onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4">
              {bulkError && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2">{bulkError}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Change Type</label>
                <select value={bulkForm.mode} onChange={e => setBulkForm(f => ({ ...f, mode: e.target.value as BulkMode }))} className={inputCls}>
                  <option value="percent">% increase (based on each employee&apos;s current salary)</option>
                  <option value="add">Add flat $ amount to each employee&apos;s current salary</option>
                  <option value="set">Set everyone to the same flat $ amount</option>
                </select>
                {bulkForm.mode !== 'set' && (
                  <span className="text-[11px] text-gray-400">Employees with no current salary on file will be skipped.</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">
                  {bulkForm.mode === 'percent' ? 'Percent Increase (%)' : bulkForm.mode === 'add' ? 'Amount to Add ($)' : 'New Annual Salary ($)'}
                </label>
                <input type="number" step="0.01" value={bulkForm.value} onChange={e => setBulkForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={bulkForm.mode === 'percent' ? '3' : '65000'} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Effective Date</label>
                <input type="date" value={bulkForm.effective_date} onChange={e => setBulkForm(f => ({ ...f, effective_date: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Note</label>
                <input value={bulkForm.note} onChange={e => setBulkForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Annual cost-of-living adjustment" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleBulkSave} disabled={!bulkForm.value || !bulkForm.effective_date || bulkSaving}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {bulkSaving ? 'Saving…' : `Apply to ${selected.size} Employees`}
              </button>
              <button onClick={() => setShowBulk(false)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
