'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string

    try {
      const result = await login(email, password)

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      // Navigate based on role / status
      if (result.status === 'pending') {
        router.push('/pending')
      } else if (result.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/employee/dashboard')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        name="password"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="current-password"
      />

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
            Signing in…
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  )
}
