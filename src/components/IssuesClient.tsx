'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markIssueReviewed, markIssuesSeen } from '@/app/actions/report-issue'
import type { IssueReport, IssueCategory } from '@/types'

type IssueRow = IssueReport & {
  employee: { name: string; email: string; job_title: string | null; department: string | null; avatar_url: string | null }
    | { name: string; email: string; job_title: string | null; department: string | null; avatar_url: string | null }[]
}

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  login: 'Account / login trouble',
  pay_balance: 'Pay, balance, or timesheet discrepancy',
  timesheet: 'Timesheet issue',
  leave_request: 'Leave request issue',
  expense: 'Expense / mileage issue',
  other: 'Something else',
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

export default function IssuesClient({ initialIssues }: { initialIssues: IssueRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Dismiss the topbar alert bell now that the manager is actually looking at the list.
  // Done client-side on mount (not during the page's server render) — markIssuesSeen()
  // calls revalidatePath, which Next.js only allows from an action, not from render.
  useEffect(() => { markIssuesSeen().catch(() => {}) }, [])

  const issues = filter === 'open' ? initialIssues.filter(i => i.status === 'open') : initialIssues
  const openCount = initialIssues.filter(i => i.status === 'open').length

  async function handleReview(id: string) {
    setError('')
    setBusyId(id)
    try {
      await markIssueReviewed(id)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Issue Reports</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Submitted from the portal&apos;s Report an Issue form</p>
        </div>
        <div className="flex bg-white border border-[#d4eef2] rounded-lg p-1 text-[12px] font-semibold">
          <button onClick={() => setFilter('open')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'open' ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'}`}>
            Open{openCount > 0 ? ` (${openCount})` : ''}
          </button>
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'}`}>
            All
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[760px]">
            <thead>
              <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
                {['Reported', 'Employee', 'Category', 'Description', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                  {filter === 'open' ? 'No open issues — nice.' : 'No issues reported yet'}
                </td></tr>
              )}
              {issues.map(issue => {
                const emp = Array.isArray(issue.employee) ? issue.employee[0] : issue.employee
                return (
                  <tr key={issue.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors align-top">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{daysAgo(issue.created_at)}</td>
                    <td className="px-4 py-3 text-[#0b2b35] font-medium whitespace-nowrap">
                      {emp?.name ?? 'Unknown'}
                      {emp?.job_title && <div className="text-[11px] text-gray-400 font-normal">{emp.job_title}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{CATEGORY_LABELS[issue.category] ?? issue.category}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[360px]">{issue.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${issue.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {issue.status === 'open' && (
                        <button
                          onClick={() => handleReview(issue.id)}
                          disabled={busyId === issue.id || isPending}
                          className="text-[12px] font-semibold text-[#02ACC0] hover:underline disabled:opacity-40"
                        >
                          {busyId === issue.id ? 'Marking…' : 'Mark Reviewed'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
