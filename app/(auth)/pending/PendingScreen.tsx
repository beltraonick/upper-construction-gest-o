'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LanguageSwitcher } from '../login/LanguageSwitcher'
import { getStoredLocale, storeLocale, t, type Locale } from '@/lib/i18n/login'

export function PendingScreen({ justRegistered }: { justRegistered: boolean }) {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    setLocale(getStoredLocale())
  }, [])

  function handleChange(l: Locale) {
    setLocale(l)
    storeLocale(l)
  }

  const steps = [t(locale, 'pendingStep1'), t(locale, 'pendingStep2'), t(locale, 'pendingStep3')]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">

        <LanguageSwitcher locale={locale} onChange={handleChange} />

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-9 h-9 text-amber">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {justRegistered && (
          <div className="bg-green/10 border border-green/20 rounded-card px-5 py-3 mb-6 inline-flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green flex-shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green font-medium">{t(locale, 'pendingAccountCreated')}</span>
          </div>
        )}

        <h1 className="text-2xl font-bold text-primary tracking-tight mb-3">
          {t(locale, 'pendingTitle')}
        </h1>
        <p className="text-secondary text-sm leading-relaxed mb-2">
          {t(locale, 'pendingBody1')}
        </p>
        <p className="text-secondary text-sm leading-relaxed">
          {t(locale, 'pendingBody2')}
        </p>

        <div className="mt-8 bg-surface rounded-card border border-[var(--border)] p-5 text-left">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">{t(locale, 'whatHappensNext')}</p>
          <ul className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-secondary">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 mt-8 text-sm text-brand hover:text-brand-hover font-medium transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          {t(locale, 'backToSignIn')}
        </Link>
      </div>
    </div>
  )
}
