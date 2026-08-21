'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitExpense, getReceiptUploadUrl, getReceiptViewUrl } from '@/app/actions/expenses'
import type { Expense, ExpenseCategory } from '@/types'

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'mileage', label: 'Mileage' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'airline', label: 'Airline' },
  { value: 'meals', label: 'Meals' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
]

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-600',
}

const currency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const emptyForm = { category: 'mileage' as ExpenseCategory, expense_date: new Date().toISOString().slice(0, 10), description: '', miles: '', amount: '' }

export default function ExpensesClient({ initialExpenses, currentMileageRate }: { initialExpenses: Expense[]; currentMileageRate: number | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const expenses = initialExpenses
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openNew() {
    setForm(emptyForm)
    setReceiptFile(null)
    setError('')
    setShowForm(true)
  }

  const previewAmount = form.category === 'mileage' && currentMileageRate && form.miles
    ? Number(form.miles) * currentMileageRate
    : null

  async function handleSubmit() {
    setError('')
    setSaving(true)
    try {
      let receipt_path: string | undefined
      if (receiptFile) {
        const { signedUrl, path } = await getReceiptUploadUrl(receiptFile.name)
        const res = await fetch(signedUrl, { method: 'PUT', body: receiptFile, headers: { 'Content-Type': receiptFile.type } })
        if (!res.ok) throw new Error('Receipt upload failed')
        receipt_path = path
      }
      await submitExpense({
        category: form.category,
        expense_date: form.expense_date,
        description: form.description,
        miles: form.category === 'mileage' ? Number(form.miles) : undefined,
        amount: form.category !== 'mileage' ? Number(form.amount) : undefined,
        receipt_path,
      })
      showToast('Expense submitted')
      setShowForm(false)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleViewReceipt(id: string) {
    try {
      const url = await getReceiptViewUrl(id)
      if (url) window.open(url, '_blank')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open receipt')
    }
  }

  const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'
  const canSubmit = form.category === 'mileage' ? Boolean(form.miles) : Boolean(form.amount)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Expenses</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Mileage and travel reimbursement — hotel, airline, meals, entertainment</p>
        </div>
        <button onClick={openNew} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + New Expense
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ {toast}
        </div>
      )}
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Date', 'Category', 'Description', 'Amount', 'Status', 'Receipt'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No expenses submitted yet</td></tr>
            )}
            {expenses.map(exp => (
              <tr key={exp.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-4 py-3 text-gray-500">{exp.expense_date}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{exp.category}{exp.category === 'mileage' && exp.miles ? ` (${exp.miles} mi)` : ''}</td>
                <td className="px-4 py-3 text-gray-500">{exp.description || '—'}</td>
                <td className="px-4 py-3 font-medium text-[#0b2b35]">{currency(exp.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[exp.status]}`}>{exp.status}</span>
                  {exp.status === 'denied' && exp.deny_reason && (
                    <div className="text-[11px] text-red-500 mt-0.5">{exp.deny_reason}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {exp.receipt_url ? (
                    <button onClick={() => handleViewReceipt(exp.id)} className="text-[12px] font-semibold text-[#02ACC0] hover:underline">View</button>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">New Expense</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {error && <div className="sm:col-span-2 bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2">{error}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))} className={inputCls}>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Date</label>
                <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className={inputCls} />
              </div>

              {form.category === 'mileage' ? (
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Miles Driven</label>
                  <input type="number" min="0" step="0.1" value={form.miles} onChange={e => setForm(f => ({ ...f, miles: e.target.value }))} className={inputCls} />
                  {currentMileageRate === null ? (
                    <span className="text-[11px] text-red-500">No mileage rate set for this year yet — ask admin/accounting manager to set it first.</span>
                  ) : previewAmount !== null ? (
                    <span className="text-[11px] text-gray-400">≈ {currency(previewAmount)} at ${currentMileageRate}/mile</span>
                  ) : null}
                </div>
              ) : (
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Amount</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inputCls} />
                </div>
              )}

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Site visit to partner agency" className={inputCls} />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Receipt (optional)</label>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-[13px] font-semibold px-3 py-2 rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors w-fit">
                  {receiptFile ? receiptFile.name : 'Attach Receipt'}
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSubmit} disabled={!canSubmit || saving || isPending}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? 'Submitting…' : 'Submit Expense'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
