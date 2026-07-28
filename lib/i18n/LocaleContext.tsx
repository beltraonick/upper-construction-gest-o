'use client'

import { createContext, useContext, useMemo } from 'react'
import { t as translate, type Locale } from './translate'

const LocaleContext = createContext<Locale | null>(null)

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

// Reads the logged-in user's saved language, set by the nearest layout from
// their session, and returns a t() function scoped to it.
export function useTranslation() {
  const locale = useContext(LocaleContext)
  if (!locale) throw new Error('useTranslation() called outside a LocaleProvider')
  const t = useMemo(() => (key: string) => translate(locale, key), [locale])
  return { t, locale }
}
