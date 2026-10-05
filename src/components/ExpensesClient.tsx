'use client'

import { errMsg } from '@/lib/user-error'
import { Fragment, useMemo, useRef, useState, useTransition } from 'react'
import { todayET, getCurrentPeriod, getPreviousPeriod } from '@/lib/pay-periods'
import { RECEIPT_REQUIRED_OVER, receiptRequired, descriptionRequired } from '@/lib/constants/expense-policy'
import OnBehalfPanel from '@/components/OnBehalfPanel'
import ExpenseAuditLog from '@/components/ExpenseAuditLog'
import { onBehalfProblem } from '@/lib/constants/on-behalf'
import { useRouter } from 'next/navigation'
import { submitExpense, getReceiptUploadUrl, getReceiptViewUrl } from '@/app/actions/expenses'
import { fmtDate } from '@/lib/format-date'
import type { Expense, ExpenseCategory } from '@/types'

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'mileage', label: 'Mileage' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'airline', label: 'Airline' },
  { value: 'meals', label: 'Meals' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'cash_advance', label: 'Cash Advance' },
  { value: 'tolls', label: 'Tolls' },
  { value: 'conference_fees', label: 'Conference Fees' },
  { value: 'rental_car', label: 'Rental Car' },
  { value: 'gratuities', label: 'Gratuities' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map(c => [c.value, c.label]))

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-600',
}

const currency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const emptyForm = { category: 'mileage' as ExpenseCategory, expense_date: todayET(), description: '', miles: '', amount: '' }

type PeriodKey = 'current' | 'previous' | 'month' | 'year' | 'all'
const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'current', label: 'Current pay period' },
  { key: 'previous', label: 'Previous pay period' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

/** Date range (inclusive, YYYY-MM-DD, Eastern Time) for a period choice; null = no limit. */
function periodRange(key: PeriodKey): { start: string; end: string } | null {
  const today = todayET()
  const asOf = new Date(`${today}T00:00:00Z`)
  if (key === 'current') return getCurrentPeriod(undefined, asOf)
  if (key === 'previous') return getPreviousPeriod(undefined, asOf)
  const [y, m] = today.split('-').map(Number)
  if (key === 'month') return { start: `${y}-${String(m).padStart(2, '0')}-01`, end: `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}` }
  if (key === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` }
  return null
}

const fmtMiles = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

export default function ExpensesClient({ initialExpenses, currentMileageRate, onBehalf }: { initialExpenses: Expense[]; currentMileageRate: number | null; /** Set when a named administrator is entering expenses for another employee (an exception). */ onBehalf?: { employeeId: string; employeeName: string; actorName: string } }) {
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
  const [period, setPeriod] = useState<PeriodKey>('current')
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [behalf, setBehalf] = useState({ reasonCode: '', note: '' })
  const behalfIssue = onBehalf ? onBehalfProblem(behalf) : null

  // Total miles entered in the chosen period (by the date of the trip), with where those miles stand.
  const mileage = useMemo(() => {
    const range = periodRange(period)
    const inRange = expenses.filter(e => e.category === 'mileage' && (!range || (e.expense_date >= range.start && e.expense_date <= range.end)))
    const sum = (status?: string) => inRange.filter(e => !status || e.status === status).reduce((t, e) => t + Number(e.miles ?? 0), 0)
    return {
      range,
      trips: inRange.length,
      total: sum(),
      approved: sum('approved'),
      pending: sum('pending'),
      denied: sum('denied'),
      amount: inRange.filter(e => e.status !== 'denied').reduce((t, e) => t + Number(e.amount), 0),
    }
  }, [expenses, period])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openNew() {
    setForm(emptyForm)
    setReceiptFile(null)
    setBehalf({ reasonCode: '', note: '' })
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
        const { signedUrl, path } = await getReceiptUploadUrl(receiptFile.name, onBehalf?.employeeId)
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
      }, onBehalf ? { employeeId: onBehalf.employeeId, onBehalf: behalf } : undefined)
      showToast('Expense submitted')
      setShowForm(false)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(errMsg(e, 'Something went wrong'))
    } finally {
      setSaving(false)
    }
  }

  async function handleViewReceipt(id: string) {
    try {
      const url = await getReceiptViewUrl(id)
      if (url) window.open(url, '_blank')
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to open receipt'))
    }
  }

  const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'
  const needsDescription = descriptionRequired(form.category)
  const missingDescription = needsDescription && !form.description.trim()
  const needsReceipt = receiptRequired(form.category, Number(form.amount))
  const missingReceipt = needsReceipt && !receiptFile
  const canSubmit = (form.category === 'mileage' ? Boolean(form.miles) : Boolean(form.amount)) && !missingDescription && !missingReceipt && !behalfIssue

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Expenses{onBehalf ? ` — for ${onBehalf.employeeName}` : ''}</h1>
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

      <div className="bg-white rounded-xl border border-[#d4eef2] p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Total miles entered</p>
            <p className="text-[28px] font-bold text-[#0b2b35] leading-tight">{fmtMiles(mileage.total)} <span className="text-[14px] font-semibold text-gray-400">mi</span></p>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {mileage.range ? `${fmtDate(mileage.range.start)} – ${fmtDate(mileage.range.end)}` : 'All dates'} · {mileage.trips} {mileage.trips === 1 ? 'entry' : 'entries'}
              {mileage.trips > 0 && currentMileageRate !== null && <> · {currency(mileage.amount)} reimbursable (excludes denied)</>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <select value={period} onChange={e => setPeriod(e.target.value as PeriodKey)} aria-label="Mileage period"
              className="px-3 py-2 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white">
              {PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {mileage.trips > 0 && (
              <p className="text-[11px] text-gray-400">
                <span className="text-emerald-600 font-semibold">{fmtMiles(mileage.approved)} approved</span> · <span className="text-amber-600 font-semibold">{fmtMiles(mileage.pending)} pending</span>{mileage.denied > 0 && <> · <span className="text-red-500 font-semibold">{fmtMiles(mileage.denied)} denied</span></>}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[820px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Date', 'Category', 'Description', 'Amount', 'Status', 'Receipt', ''].map((h, i) => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No expenses submitted yet</td></tr>
            )}
            {expenses.map(exp => (
              <Fragment key={exp.id}>
              <tr className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-4 py-3 text-gray-500">{fmtDate(exp.expense_date)}</td>
                <td className="px-4 py-3 text-gray-500">{CATEGORY_LABELS[exp.category] ?? exp.category}{exp.category === 'mileage' && exp.miles ? ` (${exp.miles} mi)` : ''}</td>
                <td className="px-4 py-3 text-gray-500">{exp.description || '—'}{exp.submitted_by_name && <div className="text-[11px] font-semibold text-amber-700 mt-0.5" title={exp.on_behalf_note ?? undefined}>Entered on the employee’s behalf by {exp.submitted_by_name}</div>}</td>
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
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setOpenHistory(h => h === exp.id ? null : exp.id)} aria-expanded={openHistory === exp.id}
                    className="text-[11px] font-semibold text-[#028a9e] hover:underline whitespace-nowrap">{openHistory === exp.id ? 'Hide history ▴' : 'History ▾'}</button>
                </td>
              </tr>
              {openHistory === exp.id && (
                <tr className="bg-[#f8fcfd] border-b border-[#f0f7f8]">
                  <td colSpan={7} className="px-5 py-4"><ExpenseAuditLog events={exp.events ?? []} /></td>
                </tr>
              )}
              </Fragment>
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
              {onBehalf && <div className="sm:col-span-2"><OnBehalfPanel employeeName={onBehalf.employeeName} actorName={onBehalf.actorName} what="expense" reasonCode={behalf.reasonCode} note={behalf.note} onChange={setBehalf} /></div>}
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
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Description{needsDescription && <span className="text-red-500"> *</span>}</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={needsDescription ? 'Where you drove and why, e.g. Office to partner agency site visit' : 'e.g. Site visit to partner agency'} className={inputCls} />
                {needsDescription && <span className={`text-[11px] ${missingDescription ? 'text-red-500' : 'text-gray-400'}`}>Required for mileage — include where you drove and the business purpose.</span>}
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Receipt{form.category === 'mileage' ? ' (not needed for mileage)' : needsReceipt ? <span className="text-red-500"> * required</span> : ` (required over $${RECEIPT_REQUIRED_OVER})`}</label>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-[13px] font-semibold px-3 py-2 rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors w-fit">
                  {receiptFile ? receiptFile.name : 'Attach Receipt'}
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
                {missingReceipt && <span className="text-[11px] text-red-500">Expenses over ${RECEIPT_REQUIRED_OVER} need a receipt — attach an image or PDF.</span>}
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
