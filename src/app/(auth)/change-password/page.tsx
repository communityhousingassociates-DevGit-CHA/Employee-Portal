'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { clearForcedPasswordChange } from '@/app/actions/auth'
import PasswordInput from '@/components/PasswordInput'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await clearForcedPasswordChange()
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f7f8] px-4">
      <div className="mb-8">
        <Image src="/cha-logo.png" alt="Community Housing Associates" width={280} height={46} className="object-contain" />
      </div>

      <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-[20px] font-bold text-[#0b2b35] mb-1">Set a new password</h1>
        <p className="text-[13px] text-gray-400 mb-6">
          For security, you need to set your own password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">New Password</label>
            <PasswordInput
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Confirm Password</label>
            <PasswordInput
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={setConfirm}
              required />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#02ACC0] text-white font-semibold py-2.5 rounded-lg text-[14px] hover:bg-[#028a9e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1">
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
