'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { updateProfile, updateAvatarUrl, getSignedUploadUrl, getPublicAvatarUrl } from '@/app/actions/profile'

type Profile = {
  id: string
  name: string
  email: string
  role: string
  employee_type: string
  department: string | null
  job_title: string | null
  hire_date: string
  avatar_url: string | null
}

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  accounting_manager: 'Accounting Manager',
  ceo: 'CEO',
  admin: 'Admin',
}

const DEPT_OPTIONS = [
  'Housing Programs',
  'Finance & Accounting',
  'Operations',
  'Administration',
  'Resident Services',
  'Maintenance',
]

export default function ProfileForm({ profile, userId }: { profile: Profile; userId: string }) {
  const [form, setForm] = useState({
    name: profile.name,
    job_title: profile.job_title || '',
    department: profile.department || '',
  })
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateProfile({
        name: form.name,
        job_title: form.job_title || null,
        department: form.department || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const { signedUrl, path } = await getSignedUploadUrl(file.name)
      const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!res.ok) throw new Error('Upload failed')
      const publicUrl = await getPublicAvatarUrl(path)
      await updateAvatarUrl(publicUrl)
      setAvatarUrl(publicUrl + '?t=' + Date.now())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Photo upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemovePhoto() {
    try {
      await updateAvatarUrl(null)
      setAvatarUrl(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove photo')
    }
  }

  return (
    <div className="max-w-2xl">
      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-5 flex items-center gap-2">
          ✅ Profile updated successfully
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-5">
          {error}
        </div>
      )}

      {/* Avatar section */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-5 flex items-center gap-6">
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={form.name} width={80} height={80}
              className="w-20 h-20 rounded-full object-cover border-2 border-[#d4eef2]" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#02ACC0] flex items-center justify-center text-white text-[24px] font-black">
              {initials}
            </div>
          )}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#0b2b35] mb-0.5">{form.name}</p>
          <p className="text-[12px] text-gray-400 mb-3">{profile.email}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors disabled:opacity-50">
              {uploading ? 'Uploading…' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            {avatarUrl && (
              <button onClick={handleRemovePhoto}
                className="text-[12px] text-red-400 hover:text-red-600 transition-colors">
                Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <p className="text-[11px] text-gray-400 mt-1.5">JPG, PNG or GIF · Max 5 MB</p>
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-5">
        <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">Personal Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Full Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Job Title</label>
            <input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
              placeholder="e.g. Housing Specialist"
              className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Department</label>
            <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0]">
              <option value="">— Select —</option>
              {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Read-only fields */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-6">
        <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">Employment Details</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Email', value: profile.email },
            { label: 'Role', value: ROLE_LABELS[profile.role] || profile.role },
            { label: 'Employee Type', value: profile.employee_type },
            { label: 'Hire Date', value: new Date(profile.hire_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">{f.label}</span>
              <span className="text-[14px] text-[#0b2b35]">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="bg-[#02ACC0] text-white text-[13px] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
