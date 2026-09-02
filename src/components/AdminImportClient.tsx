'use client'

import { useRef, useState } from 'react'
import {
  parseEmployeeFile, parseBalanceFile, parseSalaryFile, validateImport, commitImport, inviteEmployees,
  submitImportForReview, getPendingImportBatch, discardImportBatch,
} from '@/app/actions/import'
import type { ParsedEmployeeRow, ParsedBalanceRow, ParsedSalaryRow, ImportPreview } from '@/lib/import/types'
import { buildFullName } from '@/lib/format-name'

type PendingBatch = {
  id: string
  preparedByName: string | null
  createdAt: string
  employeeCount: number
  balanceCount: number
  salaryCount: number
}

function formatSubmitted(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

type Step = 'upload' | 'review' | 'done'

const STATUS_STYLES: Record<'ok' | 'warning' | 'error', string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-600',
}

const TEMPLATES = [
  { href: '/templates/Employee_Information_Intake.xlsx', label: 'Employee Information Intake' },
  { href: '/templates/Leave_Balance_Validation.xlsx', label: 'Leave Balance Validation' },
  { href: '/templates/Salary_Data_Intake.xlsx', label: 'Salary Data Intake' },
]

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  const label = status === 'ok' ? 'Ready' : status === 'warning' ? 'Warning' : 'Error'
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[status]}`}>{label}</span>
}

export default function AdminImportClient({
  isSuperAdmin,
  superAdminName,
  initialPendingBatches,
}: {
  isSuperAdmin: boolean
  superAdminName: string | null
  initialPendingBatches: PendingBatch[]
}) {
  const [step, setStep] = useState<Step>('upload')
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>(initialPendingBatches)
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState<string | null>(null)
  const [submittedForReview, setSubmittedForReview] = useState(false)
  const [employeeFileName, setEmployeeFileName] = useState('')
  const [balanceFileName, setBalanceFileName] = useState('')
  const [salaryFileName, setSalaryFileName] = useState('')
  const employeeFileRef = useRef<HTMLInputElement>(null)
  const balanceFileRef = useRef<HTMLInputElement>(null)
  const salaryFileRef = useRef<HTMLInputElement>(null)

  const [employeeRows, setEmployeeRows] = useState<ParsedEmployeeRow[]>([])
  const [balanceRows, setBalanceRows] = useState<ParsedBalanceRow[]>([])
  const [salaryRows, setSalaryRows] = useState<ParsedSalaryRow[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ employeesCreated: number; balancesCreated: number; salariesCreated: number; skipped: string[]; createdEmployees: { id: string; name: string; email: string }[] } | null>(null)
  const [inviteResult, setInviteResult] = useState<{ invited: string[]; failed: { email: string; error: string }[] } | null>(null)
  const [inviting, setInviting] = useState(false)

  async function handleParseAndValidate() {
    setError('')
    const empFile = employeeFileRef.current?.files?.[0]
    const balFile = balanceFileRef.current?.files?.[0]
    const salFile = salaryFileRef.current?.files?.[0]
    if (!empFile || !balFile) {
      setError('Employee Information Intake and Leave Balance Validation are both required')
      return
    }
    setLoading(true)
    try {
      const empFormData = new FormData()
      empFormData.set('file', empFile)
      const balFormData = new FormData()
      balFormData.set('file', balFile)

      const parsePromises: [Promise<ParsedEmployeeRow[]>, Promise<ParsedBalanceRow[]>, Promise<ParsedSalaryRow[]>] = [
        parseEmployeeFile(empFormData),
        parseBalanceFile(balFormData),
        salFile ? (() => { const fd = new FormData(); fd.set('file', salFile); return parseSalaryFile(fd) })() : Promise.resolve([]),
      ]
      const [empRows, balRows, salRows] = await Promise.all(parsePromises)
      const validated = await validateImport(empRows, balRows, salRows)

      setEmployeeRows(empRows)
      setBalanceRows(balRows)
      setSalaryRows(salRows)
      setPreview(validated)
      setAcknowledged(false)
      setCurrentBatchId(null)
      setSubmittedForReview(false)
      setStep('review')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse or validate files')
    } finally {
      setLoading(false)
    }
  }

  async function handleReviewBatch(batchId: string) {
    setError('')
    setBatchLoading(batchId)
    try {
      const batch = await getPendingImportBatch(batchId)
      setEmployeeRows(batch.employees)
      setBalanceRows(batch.balances)
      setSalaryRows(batch.salaries)
      setPreview(batch.preview)
      setEmployeeFileName(batch.employeeFileName ?? '')
      setBalanceFileName(batch.balanceFileName ?? '')
      setSalaryFileName(batch.salaryFileName ?? '')
      setAcknowledged(false)
      setCurrentBatchId(batchId)
      setSubmittedForReview(false)
      setStep('review')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load batch for review')
    } finally {
      setBatchLoading(null)
    }
  }

  async function handleDiscardBatch(batchId: string) {
    setError('')
    setBatchLoading(batchId)
    try {
      await discardImportBatch(batchId)
      setPendingBatches(bs => bs.filter(b => b.id !== batchId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to discard batch')
    } finally {
      setBatchLoading(null)
    }
  }

  async function handleSubmitForReview() {
    if (!preview) return
    setError('')
    setLoading(true)
    try {
      const okEmployees = preview.employees.filter(r => r.status !== 'error').map(r => r.data)
      const okBalances = preview.balances.filter(r => r.status !== 'error').map(r => r.data)
      const okSalaries = preview.salaries.filter(r => r.status !== 'error').map(r => r.data)
      await submitImportForReview({
        employees: okEmployees,
        balances: okBalances,
        salaries: okSalaries,
        employeeFileName,
        balanceFileName,
        salaryFileName: salaryFileName || null,
      })
      setSubmittedForReview(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit for review')
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    if (!preview) return
    setError('')
    setLoading(true)
    try {
      const okEmployees = preview.employees.filter(r => r.status !== 'error').map(r => r.data)
      const okBalances = preview.balances.filter(r => r.status !== 'error').map(r => r.data)
      const okSalaries = preview.salaries.filter(r => r.status !== 'error').map(r => r.data)
      const res = await commitImport({ employees: okEmployees, balances: okBalances, salaries: okSalaries, batchId: currentBatchId ?? undefined })
      if (currentBatchId) setPendingBatches(bs => bs.filter(b => b.id !== currentBatchId))
      setResult(res)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to commit import')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    if (!result) return
    setInviting(true)
    try {
      const res = await inviteEmployees(result.createdEmployees.map(e => e.id))
      setInviteResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send invites')
    } finally {
      setInviting(false)
    }
  }

  function reset() {
    setStep('upload')
    setEmployeeFileName('')
    setBalanceFileName('')
    setSalaryFileName('')
    setEmployeeRows([])
    setBalanceRows([])
    setSalaryRows([])
    setPreview(null)
    setResult(null)
    setInviteResult(null)
    setError('')
    setCurrentBatchId(null)
    setSubmittedForReview(false)
    if (employeeFileRef.current) employeeFileRef.current.value = ''
    if (balanceFileRef.current) balanceFileRef.current.value = ''
    if (salaryFileRef.current) salaryFileRef.current.value = ''
  }

  const hasErrors = (preview?.summary.errors ?? 0) > 0
  const hasWarnings = (preview?.summary.warnings ?? 0) > 0
  const canContinue = !hasErrors && (!hasWarnings || acknowledged)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">Data Import</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Download a template, fill it out, and upload it here — one pass updates the roster, leave balances, and salary records together</p>
      </div>

      <div className="bg-[#f8fcfd] border border-[#e8f4f7] rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-semibold text-[#0b2b35]">Download a blank template:</span>
        {TEMPLATES.map(t => (
          <a key={t.href} href={t.href} download
            className="text-[12px] font-semibold text-[#02ACC0] border border-[#d4eef2] bg-white px-3 py-1.5 rounded-lg hover:bg-[#f0f7f8] transition-colors">
            ⬇ {t.label}
          </a>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {step === 'upload' && isSuperAdmin && pendingBatches.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mb-6">
          <div className="bg-amber-50 px-5 py-3 border-b border-amber-200">
            <h2 className="text-[13px] font-bold text-amber-800">Awaiting Your Review ({pendingBatches.length})</h2>
          </div>
          <div className="divide-y divide-[#f0f7f8]">
            {pendingBatches.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap">
                <div>
                  <p className="text-[13px] font-semibold text-[#0b2b35]">
                    {b.employeeCount} employee{b.employeeCount === 1 ? '' : 's'} · {b.balanceCount} balance{b.balanceCount === 1 ? '' : 's'}
                    {b.salaryCount > 0 ? ` · ${b.salaryCount} salar${b.salaryCount === 1 ? 'y' : 'ies'}` : ''}
                  </p>
                  <p className="text-[12px] text-gray-400">
                    Submitted by {b.preparedByName ?? 'an admin'} · {formatSubmitted(b.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReviewBatch(b.id)} disabled={batchLoading === b.id}
                    className="bg-[#02ACC0] text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40">
                    {batchLoading === b.id ? 'Loading…' : 'Review'}
                  </button>
                  <button onClick={() => handleDiscardBatch(b.id)} disabled={batchLoading === b.id}
                    className="border border-[#d4eef2] text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-[#f0f7f8] transition-colors disabled:opacity-40">
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Employee Information Intake (.xlsx)</label>
              <button type="button" onClick={() => employeeFileRef.current?.click()}
                className="border border-dashed border-[#d4eef2] rounded-lg px-4 py-6 text-[13px] text-gray-500 hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors">
                {employeeFileName || 'Click to choose a file'}
              </button>
              <input ref={employeeFileRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => setEmployeeFileName(e.target.files?.[0]?.name ?? '')} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Leave Balance Validation (.xlsx)</label>
              <button type="button" onClick={() => balanceFileRef.current?.click()}
                className="border border-dashed border-[#d4eef2] rounded-lg px-4 py-6 text-[13px] text-gray-500 hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors">
                {balanceFileName || 'Click to choose a file'}
              </button>
              <input ref={balanceFileRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => setBalanceFileName(e.target.files?.[0]?.name ?? '')} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Salary Data Intake (.xlsx) <span className="normal-case font-normal text-gray-400">— optional</span></label>
              <button type="button" onClick={() => salaryFileRef.current?.click()}
                className="border border-dashed border-[#d4eef2] rounded-lg px-4 py-6 text-[13px] text-gray-500 hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors">
                {salaryFileName || 'Click to choose a file'}
              </button>
              <input ref={salaryFileRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => setSalaryFileName(e.target.files?.[0]?.name ?? '')} />
            </div>
          </div>
          <button onClick={handleParseAndValidate} disabled={!employeeFileName || !balanceFileName || loading}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Parsing…' : 'Parse & Review'}
          </button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && preview && (
        <div>
          <div className={`rounded-lg px-4 py-2.5 mb-4 text-[13px] font-semibold ${hasErrors ? 'bg-red-50 border border-red-200 text-red-600' : hasWarnings ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
            {preview.summary.ready} ready · {preview.summary.warnings} warnings · {preview.summary.errors} errors
          </div>

          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-2">Employees ({preview.employees.length})</h2>
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
                    {['Row', 'Name', 'Email', 'Role', 'Hire Date', 'Status', 'Issues'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.employees.map(r => (
                    <tr key={r.data.rowIndex} className="border-b border-[#f0f7f8] last:border-0">
                      <td className="px-4 py-2.5 text-gray-400">{r.data.rowIndex + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-[#0b2b35]">{buildFullName(r.data.first_name, r.data.last_name, r.data.middle_initial) || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.data.email || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 capitalize">{r.data.role || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.data.hire_date || '—'}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 text-gray-500 text-[12px]">
                        {r.issues.map((iss, idx) => <div key={idx} className={iss.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>{iss.message}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-2">Leave Balances ({preview.balances.length})</h2>
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
                    {['Row', 'Name', 'Matched Email', 'PTO', 'Sick', 'Personal', 'Status', 'Issues'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.balances.map(r => (
                    <tr key={r.data.rowIndex} className="border-b border-[#f0f7f8] last:border-0">
                      <td className="px-4 py-2.5 text-gray-400">{r.data.rowIndex + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-[#0b2b35]">{r.data.name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.data.matchedEmail || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.data.ptoBalance ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.data.sickBalance ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.data.personalBalance ?? '—'}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 text-gray-500 text-[12px]">
                        {r.issues.map((iss, idx) => <div key={idx} className={iss.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>{iss.message}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.salaries.length > 0 && (
            <>
              <h2 className="text-[14px] font-bold text-[#0b2b35] mb-2">Salaries ({preview.salaries.length})</h2>
              <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[760px]">
                    <thead>
                      <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
                        {['Row', 'Name', 'Matched Email', 'Annual Salary', 'Effective Date', 'Status', 'Issues'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.salaries.map(r => (
                        <tr key={r.data.rowIndex} className="border-b border-[#f0f7f8] last:border-0">
                          <td className="px-4 py-2.5 text-gray-400">{r.data.rowIndex + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[#0b2b35]">{r.data.name || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{r.data.matchedEmail || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{r.data.annualSalary !== null ? `$${r.data.annualSalary.toLocaleString()}` : '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{r.data.effectiveDate || '—'}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                          <td className="px-4 py-2.5 text-gray-500 text-[12px]">
                            {r.issues.map((iss, idx) => <div key={idx} className={iss.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>{iss.message}</div>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {hasWarnings && !hasErrors && (
            <label className="flex items-center gap-2 text-[13px] text-gray-600 mb-4">
              <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />
              I&apos;ve reviewed the warnings above and want to proceed anyway
            </label>
          )}

          {isSuperAdmin ? (
            <div className="flex gap-3">
              <button onClick={handleCommit} disabled={!canContinue || loading}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? 'Creating…' : `Create ${preview.employees.filter(r => r.status !== 'error').length} Employees + Balances${preview.salaries.length ? ' + Salaries' : ''}`}
              </button>
              <button onClick={reset} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
                Start Over
              </button>
            </div>
          ) : (
            <div>
              {submittedForReview ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-3 mb-3">
                  ✅ Submitted for review. {superAdminName ? `${superAdminName} has` : 'The system admin has'} been alerted and can commit it from Admin Console → Data Import.
                </div>
              ) : canContinue ? (
                <div className="bg-[#f8fcfd] border border-[#d4eef2] text-[#0b2b35] text-[13px] rounded-lg px-4 py-3 mb-3">
                  This batch is ready. Submit it for {superAdminName ? superAdminName : 'the system admin'} to review and commit.
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-3 mb-3">
                  Resolve the error(s) above before this can be submitted for review.
                </div>
              )}
              <div className="flex gap-3">
                {!submittedForReview && (
                  <button onClick={handleSubmitForReview} disabled={!canContinue || loading}
                    className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {loading ? 'Submitting…' : 'Submit for Review'}
                  </button>
                )}
                <button onClick={reset} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
                  {submittedForReview ? 'Import More' : 'Start Over'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && result && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4">
            ✅ Created {result.employeesCreated} employees, {result.balancesCreated} leave balance records, and {result.salariesCreated} salary records.
            {result.skipped.length > 0 && ` Skipped ${result.skipped.length} already-existing email(s): ${result.skipped.join(', ')}.`}
          </div>

          {!inviteResult && result.createdEmployees.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mb-4">
              <p className="text-[13px] text-amber-800 mb-3">
                This will email real portal invites to {result.createdEmployees.length} people. Only do this once the seeded data above looks correct.
              </p>
              <button onClick={handleInvite} disabled={inviting}
                className="bg-amber-600 text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-40">
                {inviting ? 'Sending…' : `Send Portal Invites Now (${result.createdEmployees.length})`}
              </button>
            </div>
          )}

          {inviteResult && (
            <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-lg p-4 mb-4 text-[13px]">
              <p className="text-emerald-700 mb-1">Invited: {inviteResult.invited.length ? inviteResult.invited.join(', ') : 'none'}</p>
              {inviteResult.failed.length > 0 && (
                <p className="text-red-600">Failed: {inviteResult.failed.map(f => `${f.email} (${f.error})`).join(', ')}</p>
              )}
            </div>
          )}

          <button onClick={reset} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
            Import More
          </button>
        </div>
      )}
    </div>
  )
}
