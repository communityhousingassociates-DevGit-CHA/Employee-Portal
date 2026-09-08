'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2.5 pr-10 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0] transition-colors" />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}
