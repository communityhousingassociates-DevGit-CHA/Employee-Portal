'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addProfileField, deleteProfileField, saveProfileField } from '@/app/actions/funding'
import { PROFILE_STATUS_LABEL, PROFILE_STATUSES, type ProfileField, type ProfileKind, type ProfileStatus } from '@/lib/constants/funding'

// Sections appear in this order; any custom section a user adds is listed after these.
const SECTION_ORDER = ['Organization', 'Leadership and governance', 'Mission and programs', 'Financials', 'Narrative boilerplate', 'Documents']

const STATUS_BADGE: Record<ProfileStatus, string> = {
  needed: 'bg-red-50 text-red-700',
  draft: 'bg-sky-50 text-sky-700',
  approved: 'bg-emerald-50 text-emerald-700',
}

const inputCls = 'w-full px-3 py-2 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1'

export default function GrantsProfile({ initialFields }: { initialFields: ProfileField[] }) {
  const router = useRouter()
  const [fields, setFields] = useState(initialFields)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ value: string; status: ProfileStatus; source_note: string }>({ value: '', status: 'draft', source_note: '' })
  const [adding, setAdding] = useState<{ section: string; label: string; kind: ProfileKind } | null>(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  // Resync when the server sends fresh rows after router.refresh().
  const [seenInitial, setSeenInitial] = useState(initialFields)
  if (seenInitial !== initialFields) { setSeenInitial(initialFields); setFields(initialFields) }

  const bySection = new Map<string, ProfileField[]>()
  for (const f of fields) bySection.set(f.section, [...(bySection.get(f.section) ?? []), f])
  const sections = [...SECTION_ORDER.filter(s => bySection.has(s)), ...[...bySection.keys()].filter(s => !SECTION_ORDER.includes(s))]

  const total = fields.length
  const approved = fields.filter(f => f.status === 'approved').length
  const drafted = fields.filter(f => f.status === 'draft').length
  const needed = total - approved - drafted
  const pct = total ? Math.round(((approved + drafted * 0.5) / total) * 100) : 0

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  function startEdit(f: ProfileField) {
    setError('')
    setEditingId(f.id)
    setDraft({ value: f.value ?? '', status: f.status === 'needed' ? 'draft' : f.status, source_note: f.source_note ?? '' })
  }

  async function handleSave(f: ProfileField) {
    setError('')
    try {
      await saveProfileField(f.id, { value: draft.value, status: draft.status, source_note: draft.source_note })
      const hasValue = draft.value.trim().length > 0
      setFields(fs => fs.map(x => (x.id === f.id
        ? { ...x, value: hasValue ? draft.value.trim() : null, status: hasValue ? draft.status : 'needed', source_note: draft.source_note.trim() || null }
        : x)))
      setEditingId(null)
      showToast('Saved')
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not save') }
  }

  async function handleDelete(f: ProfileField) {
    if (!window.confirm(`Delete the field "${f.label}"?`)) return
    try {
      await deleteProfileField(f.id)
      setFields(fs => fs.filter(x => x.id !== f.id))
      setEditingId(null)
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not delete') }
  }

  async function handleAdd() {
    if (!adding) return
    setError('')
    try {
      await addProfileField(adding)
      setAdding(null)
      showToast('Field added')
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not add field') }
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); showToast(`${what} copied`) } catch { showToast('Copy is not available in this browser') }
  }

  // Plain-text export of everything that has content, grouped by section, for pasting into an application or a doc.
  function exportText() {
    return sections.map(s => {
      const rows = (bySection.get(s) ?? []).filter(f => f.value)
      return rows.length ? `${s.toUpperCase()}\n` + rows.map(f => `${f.label}: ${f.value}`).join('\n') : ''
    }).filter(Boolean).join('\n\n')
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-gray-500 max-w-[80ch]">
        One place for the facts and wording CHA reuses in every application. Fill each field once, mark it approved when the CEO has confirmed it, then copy it into forms.
        Draft values come from the FY2024 Form 990 and earlier research; confirm them before they go to a funder.
      </p>

      {toast && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5">{toast}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-[#d4eef2] rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Profile readiness</p>
          <div className="h-2 bg-[#e0f5f8] rounded-full mt-2 overflow-hidden"><div className="h-full bg-[#02ACC0]" style={{ width: `${pct}%` }} /></div>
          <p className="text-[12px] text-gray-500 mt-1.5">{approved} approved · {drafted} draft · {needed} still needed</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => copy(exportText(), 'Profile')} className="text-[13px] font-semibold px-3 py-2 rounded-lg border border-[#02ACC0] text-[#02ACC0] hover:bg-[#f0fafb]">Copy all as text</button>
          <button onClick={() => { setError(''); setAdding({ section: SECTION_ORDER[0], label: '', kind: 'long' }) }} className="text-[13px] font-semibold px-3 py-2 rounded-lg bg-[#02ACC0] text-white hover:bg-[#028a9e]">+ Add field</button>
        </div>
      </div>

      {adding && (
        <div className="bg-white border border-[#d4eef2] rounded-xl p-4 shadow-sm grid sm:grid-cols-[1fr_2fr_1fr_auto] gap-3 items-end">
          <div><label className={labelCls}>Section</label>
            <input list="gp-sections" className={inputCls} value={adding.section} onChange={e => setAdding({ ...adding, section: e.target.value })} />
            <datalist id="gp-sections">{sections.map(s => <option key={s} value={s} />)}</datalist></div>
          <div><label className={labelCls}>Label</label><input className={inputCls} value={adding.label} onChange={e => setAdding({ ...adding, label: e.target.value })} placeholder="e.g. Accessibility policy" /></div>
          <div><label className={labelCls}>Type</label>
            <select className={inputCls} value={adding.kind} onChange={e => setAdding({ ...adding, kind: e.target.value as ProfileKind })}>
              <option value="text">Short text</option><option value="long">Paragraph</option><option value="document">Document</option>
            </select></div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e]">Add</button>
            <button onClick={() => setAdding(null)} className="text-[13px] px-3 py-2 rounded-lg border border-[#d4eef2] text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {sections.map(section => {
        const rows = bySection.get(section) ?? []
        const done = rows.filter(r => r.status !== 'needed').length
        return (
          <div key={section} className="bg-white border border-[#d4eef2] rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b2b35] text-white">
              <h2 className="text-[12px] uppercase tracking-widest font-bold">{section}</h2>
              <span className="text-[11px] text-white/70">{done} of {rows.length} filled</span>
            </div>
            {rows.map(f => (
              <div key={f.id} className="px-4 py-3 border-b border-[#f0f7f8] last:border-0">
                {editingId === f.id ? (
                  <div className="space-y-2">
                    <label className={labelCls}>{f.label}</label>
                    {f.kind === 'text'
                      ? <input className={inputCls} value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} autoFocus />
                      : <textarea rows={f.kind === 'long' ? 5 : 2} className={inputCls} value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} autoFocus
                          placeholder={f.kind === 'document' ? 'Link or folder where the file lives' : ''} />}
                    <div className="grid sm:grid-cols-[1fr_2fr] gap-2">
                      <select className={inputCls} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as ProfileStatus })}>
                        {PROFILE_STATUSES.filter(s => s !== 'needed').map(s => <option key={s} value={s}>{PROFILE_STATUS_LABEL[s]}</option>)}
                      </select>
                      <input className={inputCls} value={draft.source_note} onChange={e => setDraft({ ...draft, source_note: e.target.value })} placeholder="Source or note (where this came from, what to confirm)" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSave(f)} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-1.5 rounded-lg hover:bg-[#028a9e]">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[13px] px-3 py-1.5 rounded-lg border border-[#d4eef2] text-gray-600">Cancel</button>
                      {f.field_key.startsWith('custom_') && <button onClick={() => handleDelete(f)} className="ml-auto text-[12px] text-red-600 hover:underline">Delete field</button>}
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-[minmax(160px,1fr)_3fr_auto] gap-x-5 gap-y-1 items-start">
                    <div>
                      <p className="text-[13px] font-semibold text-[#0b2b35]">{f.label}</p>
                      <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[f.status]}`}>{PROFILE_STATUS_LABEL[f.status]}</span>
                    </div>
                    <div className="min-w-0">
                      {f.value
                        ? <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">{f.value}</p>
                        : <p className="text-[13px] text-gray-400 italic">Not filled in yet</p>}
                      {f.source_note && <p className="text-[12px] text-gray-500 mt-1 break-words">{f.source_note}</p>}
                    </div>
                    <div className="flex gap-3 text-[12px] sm:justify-end whitespace-nowrap">
                      {f.value && <button onClick={() => copy(f.value!, f.label)} className="text-[#02ACC0] hover:underline">Copy</button>}
                      <button onClick={() => startEdit(f)} className="text-[#02ACC0] hover:underline">{f.value ? 'Edit' : 'Fill in'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
