'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addGrant, renameGrant, deactivateGrant, restoreGrant } from '@/app/actions/grants'

type Grant = {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export default function GrantsClient({ initialGrants }: { initialGrants: Grant[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [grants, setGrants] = useState<Grant[]>(initialGrants)
  const [filter, setFilter] = useState<'active' | 'inactive'>('active')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const visible = grants.filter(g => filter === 'active' ? g.is_active : !g.is_active)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openNew() {
    setEditId(null)
    setName('')
    setError('')
    setShowForm(true)
  }

  function openEdit(g: Grant) {
    setEditId(g.id)
    setName(g.name)
    setError('')
    setShowForm(true)
  }

  async function handleSave() {
    setError('')
    try {
      if (editId) {
        await renameGrant(editId, name)
        showToast('Grant updated')
      } else {
        await addGrant(name)
        showToast('Grant added')
      }
      setShowForm(false)
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  async function handleDeactivate(id: string) {
    await deactivateGrant(id)
    setGrants(gs => gs.map(g => g.id === id ? { ...g, is_active: false } : g))
    showToast('Grant deactivated')
  }

  async function handleRestore(id: string) {
    await restoreGrant(id)
    setGrants(gs => gs.map(g => g.id === id ? { ...g, is_active: true } : g))
    showToast('Grant restored')
  }

  const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]'

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Grants</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage funding sources employees can be tagged with</p>
        </div>
        <button onClick={openNew} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Add Grant
        </button>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ {toast}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors capitalize
              ${filter === f ? 'bg-[#0b2b35] text-white' : 'bg-white border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8]'}`}>
            {f} ({grants.filter(g => f === 'active' ? g.is_active : !g.is_active).length})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[500px]">
          <thead>
            <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
              {['Name', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">No {filter} grants</td></tr>
            )}
            {visible.map(g => (
              <tr key={g.id} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#f9fefe] transition-colors">
                <td className="px-4 py-3 font-medium text-[#0b2b35]">{g.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${g.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {g.is_active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(g)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] hover:bg-[#f0f7f8]">Rename</button>
                    {g.is_active
                      ? <button onClick={() => handleDeactivate(g.id)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-amber-200 text-amber-600 hover:bg-amber-50">Deactivate</button>
                      : <button onClick={() => handleRestore(g.id)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50">Restore</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">{editId ? 'Rename Grant' : 'Add New Grant'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 flex flex-col gap-1.5">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2 mb-3">{error}</div>}
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Grant / Funding Source Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HUD CoC Grant" className={inputCls} />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={!name || isPending}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editId ? 'Save Changes' : 'Add Grant'}
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
