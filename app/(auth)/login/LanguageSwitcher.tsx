'use client'

import { LOCALES, type Locale } from '@/lib/i18n/login'

export function LanguageSwitcher({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-5" role="group" aria-label="Language">
      {LOCALES.map(l => (
        <button
          key={l.value}
          type="button"
          onClick={() => onChange(l.value)}
          title={l.label}
          aria-label={l.label}
          aria-pressed={locale === l.value}
          className={[
            'w-7 h-7 flex items-center justify-center rounded-full text-sm transition-all duration-150',
            locale === l.value
              ? 'ring-2 ring-brand ring-offset-2 ring-offset-background opacity-100'
              : 'opacity-40 hover:opacity-75',
          ].join(' ')}
        >
          <span aria-hidden="true">{l.flag}</span>
        </button>
      ))}
    </div>
  )
}
