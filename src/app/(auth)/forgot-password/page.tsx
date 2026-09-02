'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    // Always show the same confirmation, whether or not the email is registered,
    // so this form can't be used to enumerate employee accounts.
    setSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f7f8] px-4">
      <div className="mb-8">
        <Image src="/cha-logo.png" alt="Community Housing Associates" width={280} height={46} className="object-contain" />
      </div>

      <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 w-full max-w-sm shadow-sm">
        {sent ? (
          <>
            <h1 className="text-[20px] font-bold text-[#0b2b35] mb-1">Check your email</h1>
            <p className="text-[13px] text-gray-500 mb-6">
              If an account exists for <span className="font-medium text-[#0b2b35]">{email}</span>, we&apos;ve sent a link to reset the password. It expires in 1 hour.
            </p>
            <Link
              href="/login"
              className="block text-center bg-[#02ACC0] text-white font-semibold py-2.5 rounded-lg text-[14px] hover:bg-[#028a9e] transition-colors">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-bold text-[#0b2b35] mb-1">Reset your password</h1>
            <p className="text-[13px] text-gray-400 mb-6">Enter your CHA email address and we&apos;ll send you a reset link</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@communityhousingassociates.org"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0] transition-colors" />
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
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-[12px] text-gray-400 text-center mt-5">
              <Link href="/login" className="text-[#02ACC0] font-medium hover:underline">Back to sign in</Link>
            </p>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-5">
        portal.communityhousingassociates.org · Powered by Globalist Pro
      </p>
    </div>
  )
}
