'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'

type RoleOption = 'employee' | 'admin' | 'client'

const ROLES: { id: RoleOption; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    id: 'employee',
    label: 'Employee',
    sub: 'Clock in, view tasks',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'Administrator',
    sub: 'Manage team & projects',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
  },
  {
    id: 'client',
    label: 'Client',
    sub: 'View project progress',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
      </svg>
    ),
  },
]

const DEMO_EMAILS: Record<RoleOption, string> = {
  admin: 'admin@orbit.test',
  employee: 'employee@orbit.test',
  client: 'client@orbit.test',
}

export function LoginForm() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<RoleOption>('employee')
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

      if (result.status === 'pending') {
        router.push('/pending')
      } else if (result.role === 'admin') {
        router.push('/admin/dashboard')
      } else if (result.role === 'client') {
        router.push('/client')
      } else {
        router.push('/home')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Role selector */}
      <div>
        <p className="text-xs font-medium text-secondary mb-2 uppercase tracking-wide">I am a…</p>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRole(r.id)}
              className={[
                'flex flex-col items-center gap-1.5 px-2 py-3 rounded-button border transition-all duration-150 text-center',
                selectedRole === r.id
                  ? 'bg-brand/10 border-brand/50 text-brand'
                  : 'bg-surface-elevated border-[rgba(255,255,255,0.07)] text-tertiary hover:text-secondary hover:border-[rgba(255,255,255,0.15)]',
              ].join(' ')}
            >
              {r.icon}
              <span className="text-[11px] font-semibold leading-tight">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Login form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder={DEMO_EMAILS[selectedRole]}
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

      {/* Dev hint */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-amber/5 border border-amber/20 rounded-card p-3">
          <p className="text-[11px] font-semibold text-amber mb-1.5">Test accounts (password: Admin123! / Employee123! / Client123!)</p>
          <div className="space-y-0.5">
            <p className="text-[11px] text-secondary font-mono">admin@orbit.test · Admin123!</p>
            <p className="text-[11px] text-secondary font-mono">employee@orbit.test · Employee123!</p>
            <p className="text-[11px] text-secondary font-mono">client@orbit.test · Client123!</p>
          </div>
        </div>
      )}
    </div>
  )
}
