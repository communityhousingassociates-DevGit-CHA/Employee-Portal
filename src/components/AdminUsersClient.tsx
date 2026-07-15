'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addEmployee, editEmployee, archiveEmployee, restoreEmployee, deleteEmployee } from '@/app/actions/employees'

type Employee = {
  id: string
  name: string
  email: string
  role: string
  employee_type: string
  department: string | null
  job_title: string | null
  hire_date: string
  tier: string
  accrual: number
  status: string
}

const typeOptions = ['Full-time', 'Part-time', 'Consultant']
const roleOptions = ['employee', 'accounting_manager', 'ceo', 'admin']
const deptOptions = ['Housing Programs', 'Finance & Accounting', 'Operations', 'Administration', 'Resident Services', 'Maintenance']
const emptyForm = { name: '', email: '', type: 'Full-time', role: 'employee', department: '', job_title: '', hire_date: '' }

export default function AdminUsersClient({ initialEmployees }: { initialEmployees: Employee[] }) {
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

  const visible = employees.filter(e => filter === 'active' ? e.status === 'active' : e.status === 'archived')

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
    setForm({ name: e.name, email: e.email, type: e.employee_type, role: e.role, department: e.department || '', job_title: e.job_title || '', hire_date: e.hire_date })
    setError('')
    setShowForm(true)
  }

  async function handleSave() {
    setError('')
    try {
      if (editId) {
        await editEmployee(editId, { name: form.name, email: form.email, employee_type: form.type, role: form.role, department: form.department, job_title: form.job_title, hire_date: form.hire_date })
        showToast('Employee updated')
      } else {
        await addEmployee({ name: form.name, email: form.email, employee_type: form.type, role: form.role, department: form.department, job_title: form.job_title, hire_date: form.hire_date })
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
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors capitalize
              ${filter === f ? 'bg-[#0b2b35] text-white' : 'bg-white border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8]'}`}>
            {f} ({employees.filter(e => f === 'active' ? e.status === 'active' : e.status === 'archived').length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[860px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Name', 'Email', 'Role', 'Type', 'Hire Date', 'Accrual Tier', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No {filter} employees</td></tr>
            )}
            {visible.map(e => (
              <tr key={e.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-4 py-3 font-medium text-[#0b2b35]">{e.name}</td>
                <td className="px-4 py-3 text-gray-400">{e.email}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{e.role.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{e.employee_type}</td>
                <td className="px-4 py-3 text-gray-500">{e.hire_date}</td>
                <td className="px-4 py-3">
                  <span className="bg-[#e0f5f8] text-[#028a9e] text-[11px] font-semibold px-2 py-0.5 rounded-full">{e.tier}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(e)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] hover:bg-[#f0f7f8]">Edit</button>
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
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
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
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Hire Date</label>
                <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className={inputCls} />
                <span className="text-[11px] text-gray-400">Accrual tier and 90-day waiting period are calculated from this date</span>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={!form.name || !form.email || !form.hire_date || isPending}
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
    </div>
  )
}
