'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { reportIssue, getIssueAttachmentUploadUrl } from '@/app/actions/report-issue'
import type { IssueCategory } from '@/types'

const CATEGORY_OPTIONS: { value: IssueCategory; label: string }[] = [
  { value: 'login', label: "Account / login trouble" },
  { value: 'pay_balance', label: 'Pay, balance, or timesheet discrepancy' },
  { value: 'timesheet', label: 'Timesheet issue' },
  { value: 'leave_request', label: 'Leave request issue' },
  { value: 'expense', label: 'Expense / mileage issue' },
  { value: 'other', label: 'Something else' },
]

const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'

export default function ReportIssueClient({ employeeName, employeeEmail }: { employeeName: string; employeeEmail: string }) {
  const pathname = usePathname()
  const [category, setCategory] = useState<IssueCategory>('other')
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    setError('')
    setSaving(true)
    try {
      let attachment_path: string | undefined
      if (screenshot) {
        const { signedUrl, path } = await getIssueAttachmentUploadUrl(screenshot.name)
        const res = await fetch(signedUrl, { method: 'PUT', body: screenshot, headers: { 'Content-Type': screenshot.type } })
        if (!res.ok) throw new Error('Screenshot upload failed — you can still submit without it')
        attachment_path = path
      }
      await reportIssue({ category, description, page_url: pathname, attachment_path })
      setSent(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-lg">
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-3">
          <span className="mr-1.5">✅</span>
          Report sent and logged — your Accounting Manager and the admin team have been notified and will follow up.
        </div>
        <button
          onClick={() => { setSent(false); setDescription(''); setCategory('other'); setScreenshot(null) }}
          className="mt-4 text-[13px] font-semibold text-[#02ACC0] hover:underline"
        >
          Report another issue
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-[22px] font-bold text-[#0b2b35]">Report an Issue</h1>
      <p className="text-[13px] text-gray-500 mt-0.5 mb-6">
        Something wrong with a balance, timesheet, or the portal itself? Let us know — this goes straight to the Accounting Manager and Globalist Pro.
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border border-[#d4eef2] p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">From</label>
          <div className="text-[13px] text-gray-500">{employeeName} ({employeeEmail})</div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">What&apos;s this about?</label>
          <select value={category} onChange={e => setCategory(e.target.value as IssueCategory)} className={inputCls}>
            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Describe the issue</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            placeholder="What happened? What did you expect instead? Include dates, amounts, or anything else that helps us track it down."
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Screenshot (optional)</label>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="text-[13px] font-semibold px-3 py-2 rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors w-fit">
            {screenshot ? screenshot.name : 'Attach Screenshot'}
          </button>
          {screenshot && (
            <button type="button" onClick={() => { setScreenshot(null); if (fileRef.current) fileRef.current.value = '' }}
              className="text-[11px] text-gray-400 hover:text-red-500 w-fit">
              Remove
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => setScreenshot(e.target.files?.[0] ?? null)} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || saving}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Sending…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
