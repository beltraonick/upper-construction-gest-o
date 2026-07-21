'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { register } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'
import type { Language } from '@/lib/auth/types'

export function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)

    try {
      const result = await register({
        invite_code: fd.get('invite_code') as string,
        email: fd.get('email') as string,
        full_name: fd.get('full_name') as string,
        phone: fd.get('phone') as string | null,
        password: fd.get('password') as string,
        confirm_password: fd.get('confirm_password') as string,
        language: (fd.get('language') as Language) || 'en',
      })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      router.push('/pending?registered=1')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Invite code — first and prominent */}
      <div className="flex flex-col gap-1.5">
        <Input
          label="Invite Code"
          name="invite_code"
          type="text"
          placeholder="e.g. ABCD-1234"
          required
          autoComplete="off"
          autoCapitalize="characters"
        />
        <p className="text-xs text-secondary">Ask your administrator for your company invite code.</p>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.07)] pt-1" />

      <Input label="Full Name" name="full_name" type="text" placeholder="John Smith" required autoComplete="name" />
      <Input label="Email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
      <Input label="Phone Number" name="phone" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-secondary">Preferred Language</label>
        <select
          name="language"
          defaultValue="en"
          className="h-11 w-full rounded-input bg-surface-elevated border border-[rgba(255,255,255,0.08)] px-4 text-sm text-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 hover:border-[rgba(255,255,255,0.14)]"
        >
          <option value="en" className="bg-[#222]">English</option>
          <option value="pt" className="bg-[#222]">Português</option>
          <option value="es" className="bg-[#222]">Español</option>
        </select>
      </div>

      <Input label="Password" name="password" type="password" placeholder="Min. 8 characters" required autoComplete="new-password" />
      <Input label="Confirm Password" name="confirm_password" type="password" placeholder="••••••••" required autoComplete="new-password" />

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-input px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 font-medium rounded-button transition-all duration-150 bg-brand hover:bg-brand-hover text-white h-12 px-6 text-base w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
            Creating account…
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  )
}
