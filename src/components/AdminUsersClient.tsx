'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addEmployee, editEmployee, archiveEmployee, restoreEmployee, deleteEmployee, sendPasswordReset, setTemporaryPassword, sendInvites, setEmployeesActive, deleteEmployees, bulkEditEmployees, type BulkEditableField } from '@/app/actions/employees'
import { formatEmployeeId } from '@/lib/constants/employee-id'
import { fmtDate } from '@/lib/format-date'

type Employee = {
  id: string
  employee_number: number
  first_name: string
  last_name: string
  middle_initial: string | null
  name: string
  email: string
  role: string
  employee_type: string
  staff_category: string
  department: string | null
  job_title: string | null
  hire_date: string
  end_date: string | null
  tier: string
  accrual: number
  status: string
  grant_id: string | null
  grant_name: string | null
  user_id: string | null
  invite_status: 'not_invited' | 'invited' | 'active'
  is_super_admin: boolean
  pto_uncapped: boolean
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
}

type Grant = { id: string; name: string }

const typeOptions = ['Full-time', 'Part-time', 'Consultant']
const roleOptions = ['employee', 'accounting_manager', 'ceo', 'admin']
const staffCategoryOptions: { value: string; label: string }[] = [
  { value: 'cha_employee', label: 'CHA Employee' },
  { value: 'resident_advocate', label: 'Resident Advocate' },
]
const deptOptions = ['Housing Programs', 'Finance & Accounting', 'Operations', 'Administration', 'Resident Services', 'Maintenance']
const emptyForm = { first_name: '', last_name: '', middle_initial: '', email: '', type: 'Full-time', role: 'employee', staff_category: 'cha_employee', department: '', job_title: '', hire_date: '', end_date: '', grant_id: '', pto_uncapped: false, is_active: true, address_line1: '', address_line2: '', city: '', state: '', postal_code: '' }

const bulkFieldOptions: { value: BulkEditableField; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'role', label: 'Portal Role' },
  { value: 'employee_type', label: 'Employee Type' },
  { value: 'staff_category', label: 'Staff Category' },
  { value: 'grant_id', label: 'Grant / Funding Source' },
  { value: 'end_date', label: 'End / Termination Date' },
  { value: 'is_active', label: 'Status (Active / Inactive)' },
]

const inviteBadge: Record<Employee['invite_status'], { label: string; cls: string }> = {
  not_invited: { label: 'Not invited', cls: 'bg-gray-100 text-gray-500' },
  invited: { label: 'Invite pending', cls: 'bg-amber-100 text-amber-700' },
  active: { label: 'Signed in', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function AdminUsersClient({ initialEmployees, grants, isSuperAdmin, currentEmployeeId }: {
  initialEmployees: Employee[]
  grants: Grant[]
  isSuperAdmin: boolean
  currentEmployeeId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [tempPasswordResult, setTempPasswordResult] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState<'invite' | 'delete' | null>(null)
  const [inviteSummary, setInviteSummary] = useState<{ invited: string[]; failed: { email: string; error: string }[]; skipped: string[] } | null>(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkField, setBulkField] = useState<BulkEditableField>('department')
  const [bulkValue, setBulkValue] = useState('')

  const visible = employees.filter(e => filter === 'active' ? e.status === 'active' : e.status === 'archived')
  const selectedEmployees = useMemo(() => employees.filter(e => selected.has(e.id)), [employees, selected])
  // Anyone active who has never signed in can be (re)invited; people who have are left alone.
  const invitable = selectedEmployees.filter(e => e.status === 'active' && e.invite_status !== 'active')
  const deletable = selectedEmployees.filter(e => e.id !== currentEmployeeId && !e.is_super_admin)
  const allVisibleSelected = visible.length > 0 && visible.every(e => selected.has(e.id))

  function switchFilter(f: 'active' | 'archived') {
    setFilter(f)
    setSelected(new Set())
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map(e => e.id)))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openNew() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(e: Employee) {
    setEditId(e.id)
    setForm({ first_name: e.first_name, last_name: e.last_name, middle_initial: e.middle_initial || '', email: e.email, type: e.employee_type, role: e.role, staff_category: e.staff_category, department: e.department || '', job_title: e.job_title || '', hire_date: e.hire_date, end_date: e.end_date || '', grant_id: e.grant_id || '', pto_uncapped: e.pto_uncapped, is_active: e.status === 'active', address_line1: e.address_line1 || '', address_line2: e.address_line2 || '', city: e.city || '', state: e.state || '', postal_code: e.postal_code || '' })
    setError('')
    setShowForm(true)
  }

  async function handleSave() {
    setError('')
    try {
      const grant_id = form.grant_id || null
      const middle_initial = form.middle_initial || null
      const address = { address_line1: form.address_line1, address_line2: form.address_line2, city: form.city, state: form.state, postal_code: form.postal_code }
      if (editId) {
        await editEmployee(editId, { first_name: form.first_name, last_name: form.last_name, middle_initial, email: form.email, employee_type: form.type, role: form.role, staff_category: form.staff_category, department: form.department, job_title: form.job_title, hire_date: form.hire_date, end_date: form.end_date, grant_id, pto_uncapped: form.pto_uncapped, is_active: form.is_active, ...address })
        if (editId !== currentEmployeeId) setEmployees(es => es.map(e => e.id === editId ? { ...e, status: form.is_active ? 'active' : 'archived' } : e))
        showToast('Employee updated')
      } else {
        await addEmployee({ first_name: form.first_name, last_name: form.last_name, middle_initial, email: form.email, employee_type: form.type, role: form.role, staff_category: form.staff_category, department: form.department, job_title: form.job_title, hire_date: form.hire_date, end_date: form.end_date, grant_id, pto_uncapped: form.pto_uncapped, is_active: form.is_active, ...address })
        showToast('Employee added')
      }
      setShowForm(false)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  async function handleArchive(id: string) {
    await archiveEmployee(id)
    setEmployees(es => es.map(e => e.id === id ? { ...e, status: 'archived' } : e))
    showToast('Employee archived')
  }

  async function handleRestore(id: string) {
    await restoreEmployee(id)
    setEmployees(es => es.map(e => e.id === id ? { ...e, status: 'active' } : e))
    showToast('Employee restored')
  }

  async function handleDelete(id: string) {
    await deleteEmployee(id)
    setEmployees(es => es.filter(e => e.id !== id))
    setConfirmDelete(null)
    showToast('Employee deleted')
  }

  async function runInvites(ids: string[]) {
    setBusy(true)
    try {
      const res = await sendInvites(ids)
      setInviteSummary(res)
      setSelected(new Set())
      startTransition(() => router.refresh())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send invites')
    } finally {
      setBusy(false)
      setConfirmBulk(null)
    }
  }

  async function handleBulkActive(active: boolean) {
    setBusy(true)
    try {
      const ids = selectedEmployees.filter(e => e.id !== currentEmployeeId).map(e => e.id)
      await setEmployeesActive(ids, active)
      setEmployees(es => es.map(e => ids.includes(e.id) ? { ...e, status: active ? 'active' : 'archived' } : e))
      showToast(`${ids.length} employee${ids.length === 1 ? '' : 's'} ${active ? 'restored' : 'archived'}`)
      setSelected(new Set())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk action failed')
    } finally {
      setBusy(false)
    }
  }

  function openBulkEdit() {
    setBulkField('department')
    setBulkValue('')
    setBulkEditOpen(true)
  }

  async function handleBulkEdit() {
    setBusy(true)
    try {
      const ids = selectedEmployees.filter(e => e.id !== currentEmployeeId).map(e => e.id)
      const value = bulkValue || null
      await bulkEditEmployees(ids, bulkField, value)
      const fieldLabel = bulkFieldOptions.find(f => f.value === bulkField)?.label ?? bulkField
      if (bulkField === 'is_active') setEmployees(es => es.map(e => ids.includes(e.id) ? { ...e, status: bulkValue === 'true' ? 'active' : 'archived' } : e))
      showToast(`${fieldLabel} updated for ${ids.length} employee${ids.length === 1 ? '' : 's'}`)
      setSelected(new Set())
      setBulkEditOpen(false)
      startTransition(() => router.refresh())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk edit failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleBulkDelete() {
    setBusy(true)
    try {
      const ids = deletable.map(e => e.id)
      await deleteEmployees(ids)
      setEmployees(es => es.filter(e => !ids.includes(e.id)))
      startTransition(() => router.refresh())
      showToast(`${ids.length} employee${ids.length === 1 ? '' : 's'} deleted`)
      setSelected(new Set())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk delete failed')
    } finally {
      setBusy(false)
      setConfirmBulk(null)
    }
  }

  async function handleResetPassword(e: Employee) {
    try {
      await sendPasswordReset(e.id)
      showToast(`Password reset link sent to ${e.email}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reset link')
    }
  }

  async function handleSetTempPassword(e: Employee) {
    try {
      const password = await setTemporaryPassword(e.id)
      setCopied(false)
      setTempPasswordResult({ email: e.email, password })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to set temporary password')
    }
  }

  async function handleCopyTempPassword() {
    if (!tempPasswordResult) return
    try {
      await navigator.clipboard.writeText(tempPasswordResult.password)
      setCopied(true)
    } catch {
      // Clipboard API unavailable — password is still shown on screen to copy manually.
    }
  }

  const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">User Management</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Add, edit, archive, or remove portal users</p>
        </div>
        <button onClick={openNew} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Add Employee
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ {toast}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['active', 'archived'] as const).map(f => (
          <button key={f} onClick={() => switchFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors capitalize
              ${filter === f ? 'bg-[#0b2b35] text-white' : 'bg-white border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8]'}`}>
            {f} ({employees.filter(e => f === 'active' ? e.status === 'active' : e.status === 'archived').length})
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#0b2b35] text-white rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold mr-2">{selected.size} selected</span>
          {isSuperAdmin && (
            <button onClick={() => setConfirmBulk('invite')} disabled={busy || invitable.length === 0}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#02ACC0] hover:bg-[#028a9e] disabled:opacity-40 disabled:cursor-not-allowed">
              ✉️ Send / Resend Invite ({invitable.length})
            </button>
          )}
          <button onClick={openBulkEdit} disabled={busy} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40">
            ✏️ Edit Field
          </button>
          {filter === 'active'
            ? <button onClick={() => handleBulkActive(false)} disabled={busy} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40">Archive</button>
            : <button onClick={() => handleBulkActive(true)} disabled={busy} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40">Restore</button>}
          <button onClick={() => setConfirmBulk('delete')} disabled={busy || deletable.length === 0}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed">
            Delete ({deletable.length})
          </button>
          <button onClick={() => setSelected(new Set())} className="text-[12px] text-white/60 hover:text-white ml-auto">Clear selection</button>
        </div>
      )}

      {/* Table — columns size to their content; the wrapper scrolls horizontally if the window is narrower */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              <th className="pl-4 pr-2 py-2.5 w-8">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all" className="accent-[#02ACC0] w-4 h-4 cursor-pointer" />
              </th>
              {['Employee ID', 'Name', 'Email', 'Role', 'Type', 'Category', 'Grant', 'Hire Date', 'End Date', 'Accrual Tier', 'Invite', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={14} className="px-5 py-8 text-center text-gray-400">No {filter} employees</td></tr>
            )}
            {visible.map(e => (
              <tr key={e.id} className={`border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors ${selected.has(e.id) ? 'bg-[#f0fafb]' : ''}`}>
                <td className="pl-4 pr-2 py-3">
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} aria-label={`Select ${e.name}`} className="accent-[#02ACC0] w-4 h-4 cursor-pointer" />
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-[12px] whitespace-nowrap">{formatEmployeeId(e.employee_number)}</td>
                <td className="px-4 py-3 font-medium text-[#0b2b35] whitespace-nowrap">{e.name}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{e.email}</td>
                <td className="px-4 py-3 text-gray-500 capitalize whitespace-nowrap">
                  {e.role.replace('_', ' ')}
                  {e.pto_uncapped && <span title="PTO Uncapped exception" className="ml-1.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full normal-case">∞ PTO</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize whitespace-nowrap">{e.employee_type}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {e.staff_category === 'resident_advocate'
                    ? <span className="bg-violet-100 text-violet-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">Resident Advocate</span>
                    : <span className="text-gray-400">CHA Employee</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.grant_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(e.hire_date)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {e.end_date ? <span className="text-red-500 font-medium">{fmtDate(e.end_date)}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="bg-[#e0f5f8] text-[#028a9e] text-[11px] font-semibold px-2 py-0.5 rounded-full">{e.tier}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${inviteBadge[e.invite_status].cls}`}>{inviteBadge[e.invite_status].label}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <button onClick={() => openEdit(e)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] hover:bg-[#f0f7f8]">Edit</button>
                    {isSuperAdmin && e.status === 'active' && e.invite_status !== 'active' && (
                      <button onClick={() => runInvites([e.id])} disabled={busy} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#02ACC0] text-[#028a9e] hover:bg-[#e0f5f8] disabled:opacity-40">
                        {e.invite_status === 'invited' ? 'Resend Invite' : 'Send Invite'}
                      </button>
                    )}
                    {e.user_id && (
                      <button onClick={() => handleResetPassword(e)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] text-[#028a9e] hover:bg-[#f0f7f8]">Reset Password</button>
                    )}
                    {e.user_id && (
                      <button onClick={() => handleSetTempPassword(e)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] text-amber-600 hover:bg-amber-50">Set Temp Password</button>
                    )}
                    {e.status === 'active'
                      ? <button onClick={() => handleArchive(e.id)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-amber-200 text-amber-600 hover:bg-amber-50">Archive</button>
                      : <button onClick={() => handleRestore(e.id)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50">Restore</button>
                    }
                    <button onClick={() => setConfirmDelete(e.id)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">{editId ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {error && <div className="sm:col-span-2 bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2">{error}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">First Name</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Jane" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Last Name</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Smith" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Middle Initial <span className="normal-case text-gray-400">(optional — for payroll)</span></label>
                <input value={form.middle_initial} onChange={e => setForm(f => ({ ...f, middle_initial: e.target.value.slice(0, 1).toUpperCase() }))} placeholder="M" maxLength={1} className={inputCls} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jsmith@communityhousingassociates.org" type="email" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Employee Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                  {typeOptions.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Portal Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                  {roleOptions.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Staff Category</label>
                <select value={form.staff_category} onChange={e => setForm(f => ({ ...f, staff_category: e.target.value }))} className={inputCls}>
                  {staffCategoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
                  <option value="">— Select —</option>
                  {deptOptions.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Job Title</label>
                <input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="e.g. Housing Specialist" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Grant / Funding Source</label>
                <select value={form.grant_id} onChange={e => setForm(f => ({ ...f, grant_id: e.target.value }))} className={inputCls}>
                  <option value="">— Unassigned —</option>
                  {grants.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Hire Date</label>
                <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className={inputCls} />
                <span className="text-[11px] text-gray-400">Accrual tier and 90-day waiting period are calculated from this date</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">End / Termination Date <span className="normal-case text-gray-400">(optional)</span></label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inputCls} />
                <span className="text-[11px] text-gray-400">Leave blank unless the employee has separated</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Status</label>
                <select value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                  disabled={editId === currentEmployeeId} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <span className="text-[11px] text-gray-400">{editId === currentEmployeeId ? 'You can’t deactivate your own account' : 'Inactive employees are archived: excluded from reports and accruals, and hidden from the roster by default'}</span>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Address Line 1</label>
                <input value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="123 Main St" className={inputCls} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Address Line 2 <span className="normal-case text-gray-400">(optional)</span></label>
                <input value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="Apt, suite, unit" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Baltimore" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">State</label>
                <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.slice(0, 2).toUpperCase() }))} placeholder="MD" maxLength={2} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Postal Code</label>
                <input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} placeholder="21201" className={inputCls} />
              </div>
              <div className="sm:col-span-2 flex items-start gap-2.5 bg-[#f8fcfd] border border-[#e8f4f7] rounded-lg px-3 py-2.5">
                <input type="checkbox" id="pto_uncapped" checked={form.pto_uncapped} onChange={e => setForm(f => ({ ...f, pto_uncapped: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-[#02ACC0] cursor-pointer flex-shrink-0" />
                <label htmlFor="pto_uncapped" className="cursor-pointer">
                  <span className="text-[13px] font-semibold text-[#0b2b35]">PTO Uncapped</span>
                  <span className="block text-[11px] text-gray-400">Exempts this employee from the standard 400-hour PTO carryover cap (e.g. an executive exception). Sick and Vacation caps are unaffected.</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={!form.first_name || !form.last_name || !form.email || !form.hire_date || isPending}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editId ? 'Save Changes' : 'Add Employee'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-sm p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-2">Delete Employee?</h2>
            <p className="text-[13px] text-gray-500 mb-5">
              This permanently removes the employee and all their leave history. Consider <strong>Archive</strong> instead to preserve records.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => handleDelete(confirmDelete)} className="bg-red-500 text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-red-600">Yes, Delete</button>
              <button onClick={() => setConfirmDelete(null)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk invite confirmation */}
      {confirmBulk === 'invite' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-sm p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">✉️</div>
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-2">Send {invitable.length} invite{invitable.length === 1 ? '' : 's'}?</h2>
            <p className="text-[13px] text-gray-500 mb-5">
              This emails real portal invite links. People with a pending invite get a fresh link (the old one stops working). Anyone who has already signed in is skipped.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => runInvites(invitable.map(e => e.id))} disabled={busy} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{busy ? 'Sending…' : 'Send Invites'}</button>
              <button onClick={() => setConfirmBulk(null)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk edit field */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-1">Edit Field</h2>
            <p className="text-[13px] text-gray-500 mb-4">
              Sets one field for all {selected.size} selected employee{selected.size === 1 ? '' : 's'}. Your own account is never included.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Field</label>
                <select value={bulkField} onChange={e => { setBulkField(e.target.value as BulkEditableField); setBulkValue('') }} className={inputCls}>
                  {bulkFieldOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">New Value</label>
                {bulkField === 'department' && (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls}>
                    <option value="">— Unassigned —</option>
                    {deptOptions.map(d => <option key={d}>{d}</option>)}
                  </select>
                )}
                {bulkField === 'role' && (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {roleOptions.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                )}
                {bulkField === 'employee_type' && (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {typeOptions.map(t => <option key={t}>{t}</option>)}
                  </select>
                )}
                {bulkField === 'staff_category' && (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {staffCategoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {bulkField === 'grant_id' && (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls}>
                    <option value="">— Unassigned —</option>
                    {grants.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                {bulkField === 'is_active' && (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                )}
                {bulkField === 'end_date' && (
                  <>
                    <input type="date" value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={inputCls} />
                    <span className="text-[11px] text-gray-400">Leave blank to clear the end date for everyone selected</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleBulkEdit}
                disabled={busy || (['role', 'employee_type', 'staff_category', 'is_active'].includes(bulkField) && !bulkValue)}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40 disabled:cursor-not-allowed">
                {busy ? 'Applying…' : `Apply to ${selected.size}`}
              </button>
              <button onClick={() => setBulkEditOpen(false)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {confirmBulk === 'delete' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-sm p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-2">Delete {deletable.length} employee{deletable.length === 1 ? '' : 's'}?</h2>
            <p className="text-[13px] text-gray-500 mb-5">
              This permanently removes them and all their leave history. Consider <strong>Archive</strong> instead to preserve records. Your own account and super admins are never deleted.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleBulkDelete} disabled={busy} className="bg-red-500 text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-40">{busy ? 'Deleting…' : 'Yes, Delete'}</button>
              <button onClick={() => setConfirmBulk(null)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite results */}
      {inviteSummary && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-3">Invites sent</h2>
            <p className="text-[13px] text-emerald-700 mb-2">Invited: {inviteSummary.invited.length ? inviteSummary.invited.join(', ') : 'none'}</p>
            {inviteSummary.skipped.length > 0 && <p className="text-[13px] text-gray-500 mb-2">Skipped (already signed in or archived): {inviteSummary.skipped.join(', ')}</p>}
            {inviteSummary.failed.length > 0 && <p className="text-[13px] text-red-600 mb-2">Failed: {inviteSummary.failed.map(f => `${f.email} (${f.error})`).join(', ')}</p>}
            <button onClick={() => setInviteSummary(null)} className="w-full mt-3 bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e]">Done</button>
          </div>
        </div>
      )}

      {/* Temp password result */}
      {tempPasswordResult && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-1">Temporary Password Set</h2>
            <p className="text-[13px] text-gray-500 mb-4">
              For <strong>{tempPasswordResult.email}</strong>. This is shown once — copy it now and hand it to the employee securely (not over email or chat).
            </p>
            <div className="flex items-center gap-2 bg-[#f0f7f8] border border-[#d4eef2] rounded-lg px-3 py-2.5 mb-4">
              <code className="text-[14px] font-mono text-[#0b2b35] flex-1 break-all">{tempPasswordResult.password}</code>
              <button onClick={handleCopyTempPassword} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] bg-white hover:bg-[#f0f7f8] flex-shrink-0">
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              They'll be required to set their own password after their 3rd sign-in with this one.
            </p>
            <button onClick={() => setTempPasswordResult(null)} className="w-full bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e]">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
