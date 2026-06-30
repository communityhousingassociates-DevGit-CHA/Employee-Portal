'use client'

import { useState } from 'react'
import { MOCK_EMPLOYEES } from '@/lib/mock-data'

type Employee = typeof MOCK_EMPLOYEES[0] & { status: string; email?: string }

const INITIAL: Employee[] = MOCK_EMPLOYEES.map((e, i) => ({
  ...e,
  email: `${e.name.split(' ')[0].toLowerCase()}@communityhousingassociates.org`,
}))

const typeOptions = ['Full-time', 'Part-time', 'Consultant']
const roleOptions = ['employee', 'accounting_manager', 'ceo', 'admin']

const departmentOptions = ['Housing Programs', 'Finance & Accounting', 'Operations', 'Administration', 'Resident Services', 'Maintenance']

const emptyForm = { name: '', email: '', type: 'Full-time', role: 'employee', hire_date: '', department: '', job_title: '' }

export default function AdminUsersPage() {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL)
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const visible = employees.filter(e => filter === 'active' ? e.status === 'active' : e.status !== 'active')

  function openNew() {
    setEditId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(e: Employee) {
    setEditId(e.id)
    setForm({ name: e.name, email: e.email || '', type: e.type, role: 'employee', hire_date: e.hire_date, department: '', job_title: '' })
    setShowForm(true)
  }

  function saveForm() {
    if (editId) {
      setEmployees(es => es.map(e => e.id === editId ? { ...e, ...form } : e))
    } else {
      const newEmp: Employee = {
        id: String(Date.now()),
        name: form.name,
        email: form.email,
        type: form.type,
        hire_date: form.hire_date,
        tier: '0–12 mo',
        accrual: 4.62,
        status: 'active',
      }
      setEmployees(es => [...es, newEmp])
    }
    setShowForm(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function archive(id: string) {
    setEmployees(es => es.map(e => e.id === id ? { ...e, status: 'archived' } : e))
  }

  function restore(id: string) {
    setEmployees(es => es.map(e => e.id === id ? { ...e, status: 'active' } : e))
  }

  function remove(id: string) {
    setEmployees(es => es.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">User Management</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Add, edit, archive, or remove portal users</p>
        </div>
        <button onClick={openNew}
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Add Employee
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ Changes saved successfully
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['active', 'archived'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors capitalize
              ${filter === f ? 'bg-[#0b2b35] text-white' : 'bg-white border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8]'}`}>
            {f} ({employees.filter(e => f === 'active' ? e.status === 'active' : e.status !== 'active').length})
          </button>
        ))}
      </div>

      {/* User table */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Name', 'Email', 'Type', 'Hire Date', 'Accrual Tier', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No {filter} employees</td></tr>
            )}
            {visible.map(e => (
              <tr key={e.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-5 py-3 font-medium text-[#0b2b35]">{e.name}</td>
                <td className="px-5 py-3 text-gray-400">{e.email}</td>
                <td className="px-5 py-3 text-gray-500">{e.type}</td>
                <td className="px-5 py-3 text-gray-500">{e.hire_date}</td>
                <td className="px-5 py-3">
                  <span className="bg-[#e0f5f8] text-[#028a9e] text-[11px] font-semibold px-2 py-0.5 rounded-full">{e.tier}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize
                    ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(e)}
                      className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors">
                      Edit
                    </button>
                    {e.status === 'active' ? (
                      <button onClick={() => archive(e.id)}
                        className="text-[12px] font-semibold px-2.5 py-1 rounded border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors">
                        Archive
                      </button>
                    ) : (
                      <button onClick={() => restore(e.id)}
                        className="text-[12px] font-semibold px-2.5 py-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors">
                        Restore
                      </button>
                    )}
                    <button onClick={() => setConfirmDelete(e.id)}
                      className="text-[12px] font-semibold px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">{editId ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">CHA Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jsmith@communityhousingassociates.org" type="email"
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Employee Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]">
                  {typeOptions.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Portal Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]">
                  {roleOptions.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]">
                  <option value="">— Select —</option>
                  {departmentOptions.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Job Title</label>
                <input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                  placeholder="e.g. Housing Specialist"
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Hire Date</label>
                <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
                <span className="text-[11px] text-gray-400">Accrual tier and 90-day waiting period are calculated from this date</span>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={saveForm}
                disabled={!form.name || !form.email || !form.hire_date}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editId ? 'Save Changes' : 'Add Employee'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-sm p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-[16px] font-bold text-[#0b2b35] mb-2">Delete Employee?</h2>
            <p className="text-[13px] text-gray-500 mb-5">
              This permanently removes the employee and all their leave history from the portal. Consider <strong>Archive</strong> instead to preserve records.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => remove(confirmDelete)}
                className="bg-red-500 text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-red-600 transition-colors">
                Yes, Delete
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
