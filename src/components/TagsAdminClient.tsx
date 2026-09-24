'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTag, updateTag, setTagActive } from '@/app/actions/tags'
import { TAG_COLORS, tagColor } from '@/lib/timesheet-tags'
import type { TimesheetTag } from '@/types'

type ManagedTag = TimesheetTag & { usage: number }

const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0] bg-white'
const emptyForm = { name: '', color: 'teal', description: '', code: '' }

export default function TagsAdminClient({ initialTags }: { initialTags: ManagedTag[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<'active' | 'retired'>('active')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const visible = initialTags.filter(t => (filter === 'active' ? t.is_active : !t.is_active))
  const retiredCount = initialTags.filter(t => !t.is_active).length

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }
  function openNew() { setEditId(null); setForm(emptyForm); setError(''); setShowForm(true) }
  function openEdit(t: ManagedTag) { setEditId(t.id); setForm({ name: t.name, color: t.color, description: t.description ?? '', code: t.code ?? '' }); setError(''); setShowForm(true) }

  async function handleSave() {
    setError('')
    try {
      if (editId) { await updateTag(editId, form); showToast('Tag updated') }
      else { await createTag(form); showToast('Tag added') }
      setShowForm(false)
      startTransition(() => router.refresh())
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Something went wrong') }
  }

  async function toggleActive(t: ManagedTag) {
    try {
      await setTagActive(t.id, !t.is_active)
      showToast(t.is_active ? `“${t.name}” retired` : `“${t.name}” restored`)
      startTransition(() => router.refresh())
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Something went wrong') }
  }

  return (
    <div className="max-w-3xl">
      {toast && <div className="fixed top-4 right-4 z-50 bg-[#0b2b35] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg">{toast}</div>}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Timesheet Tags</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">The list employees pick from when tagging a day on their timesheet — e.g. a grant, program, or activity.</p>
        </div>
        <button onClick={openNew} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">+ New Tag</button>
      </div>
      <p className="text-[12px] text-gray-400 mb-6">
        Tags label a day; they don&apos;t split its hours. Employees tag their own days while a timesheet is a draft, and approvers can adjust during review.
        Retire a tag to stop new use — it stays on the days that already have it. The optional payroll code is for matching Sage later.
      </p>

      <div className="flex gap-2 mb-4">
        {(['active', 'retired'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-colors ${filter === f ? 'bg-[#0b2b35] text-white' : 'bg-white border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8]'}`}>
            {f} ({f === 'active' ? initialTags.length - retiredCount : retiredCount})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-10 text-center text-[13px] text-gray-400">
          {filter === 'active' ? 'No tags yet — add the first one.' : 'No retired tags.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
          {visible.map(t => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#f0f7f8] last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${tagColor(t.color).cls}`}>{t.name}</span>
                  {t.code && <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.code}</span>}
                  <span className="text-[11px] text-gray-400">{t.usage} day{t.usage === 1 ? '' : 's'} tagged</span>
                </div>
                {t.description && <p className="text-[12px] text-gray-500 mt-1">{t.description}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(t)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] hover:bg-[#f0f7f8]">Edit</button>
                <button onClick={() => toggleActive(t)} className={`text-[12px] font-semibold px-2.5 py-1 rounded border ${t.is_active ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                  {t.is_active ? 'Retire' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d4eef2] w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4eef2]">
              <h2 className="text-[16px] font-bold text-[#0b2b35]">{editId ? 'Edit Tag' : 'New Tag'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2">{error}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Name</label>
                <input value={form.name} maxLength={40} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HUD CoC Grant" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Color</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TAG_COLORS).map(([key, c]) => (
                    <button key={key} type="button" onClick={() => setForm(f => ({ ...f, color: key }))} aria-label={c.label} title={c.label}
                      className={`w-7 h-7 rounded-full ${c.dot} ${form.color === key ? 'ring-2 ring-offset-2 ring-[#0b2b35]' : ''}`} />
                  ))}
                </div>
                <span className="text-[11px] text-gray-400">Preview: <span className={`font-semibold px-2 py-0.5 rounded-full ${tagColor(form.color).cls}`}>{form.name || 'Tag name'}</span></span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Description <span className="normal-case font-normal text-gray-400">(optional — shown on hover)</span></label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="When should this tag be used?" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Payroll / Sage code <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. GRANT-01" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={!form.name.trim() || isPending}
                className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editId ? 'Save Changes' : 'Add Tag'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#f0f7f8]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
