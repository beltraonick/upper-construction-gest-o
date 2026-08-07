'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from './LoginForm'
import { LanguageSwitcher } from './LanguageSwitcher'
import { getStoredLocale, storeLocale, t, type Locale } from '@/lib/i18n/login'
import { restoreSession } from '@/app/actions/auth'
import { getRememberToken, clearRememberToken, roleRedirectPath } from '@/lib/auth/remember'

export function LoginScreen({ showOwnerRole = false }: { showOwnerRole?: boolean }) {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  // Starts true so we don't flash the login form while checking for a
  // saved session to silently restore (see lib/auth/remember.ts).
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    setLocale(getStoredLocale())
  }, [])

  useEffect(() => {
    const token = getRememberToken()
    if (!token) { setRestoring(false); return }

    restoreSession(token)
      .then(result => {
        if (result.error) {
          clearRememberToken()
          setRestoring(false)
          return
        }
        router.push(roleRedirectPath(result.role, result.status))
      })
      .catch(() => setRestoring(false))
  }, [router])

  function handleChange(l: Locale) {
    setLocale(l)
    storeLocale(l)
  }

  if (restoring) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-7 h-7 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <LanguageSwitcher locale={locale} onChange={handleChange} />

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="OrbitOps" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-primary tracking-tight">OrbitOps</h1>
          <p className="text-sm text-secondary mt-1">{t(locale, 'tagline')}</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-card border border-[var(--border)] p-6">
          <LoginForm locale={locale} showOwnerRole={showOwnerRole} />
        </div>


      </div>
    </div>
  )
}
