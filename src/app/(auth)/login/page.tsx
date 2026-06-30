'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'

const DEMO_EMAIL = 'demo@communityhousingassociates.org'
const DEMO_PASSWORD = 'CHAdemo2026!'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      await fetch('/api/demo-login', { method: 'POST' })
      router.push('/dashboard')
      router.refresh()
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  function fillDemo() {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f7f8] px-4">
      {/* Logo */}
      <div className="mb-8">
        <Image src="/cha-logo.png" alt="Community Housing Associates" width={280} height={46} className="object-contain" />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-[20px] font-bold text-[#0b2b35] mb-1">Sign in</h1>
        <p className="text-[13px] text-gray-400 mb-6">Use your CHA email address to continue</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 border-t border-[#f0f7f8] pt-4">
          <button
            type="button"
            onClick={fillDemo}
            className="w-full text-[13px] text-[#02ACC0] border border-[#d4eef2] rounded-lg py-2 hover:bg-[#f0f7f8] transition-colors font-medium">
            Use Demo Account
          </button>
        </div>

        <p className="text-[12px] text-gray-400 text-center mt-5">
          Trouble signing in? Contact your administrator.
        </p>
      </div>

      {/* Scope document link */}
      <div className="mt-5">
        <Link
          href="/scope"
          className="text-[12px] text-[#02ACC0] hover:text-[#028a9e] font-medium transition-colors underline underline-offset-2">
          View Project Scope Document →
        </Link>
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        portal.communityhousingassociates.org · Powered by Globalist Pro
      </p>
    </div>
  )
}
