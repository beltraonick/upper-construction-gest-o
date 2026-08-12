'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ownerResetPassword, ownerSetAccountStatus, startImpersonation } from '@/app/actions/owner'
import { roleRedirectPath } from '@/lib/auth/remember'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/lib/i18n/LocaleContext'

interface Person {
  id: string
  full_name: string
  email: string
  phone: string | null
  position: string | null
  role: string
  auth_status: string
  last_login_at: string | null
}

const DATE_LOCALE: Record<string, string> = { en: 'en-US', pt: 'pt-BR', es: 'es-ES' }

function statusBadge(status: string) {
  if (status === 'approved') return <Badge variant="green">{status}</Badge>
  if (status === 'suspended') return <Badge variant="red">{status}</Badge>
  return <Badge variant="amber">{status}</Badge>
}

// "3 days ago" style label so the owner doesn't have to do date math —
// the exact timestamp is still shown alongside it for precision.
function relativeTime(iso: string, t: (key: string) => string): string {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diffDays <= 0) return t('owner.companyDetail.today')
  if (diffDays === 1) return t('owner.companyDetail.yesterday')
  if (diffDays < 30) return `${diffDays} ${t('owner.companyDetail.daysAgo')}`
  const months = Math.floor(diffDays / 30)
  return `${months} ${months === 1 ? t('owner.companyDetail.monthAgo') : t('owner.companyDetail.monthsAgo')}`
}

function PersonRow({
  person,
  locale,
  t,
  accessesThisMonth,
  accessHistory,
}: {
  person: Person
  locale: string
  t: (key: string) => string
  accessesThisMonth: number
  accessHistory: string[]
}) {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState(person.auth_status)
  const [resetting, setResetting] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [impersonating, setImpersonating] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  async function handleReset() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    setError('')
    const result = await ownerResetPassword(person.id, password)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSaved(true)
    setPassword('')
  }

  async function handleImpersonate() {
    setImpersonating(true)
    const result = await startImpersonation(person.id)
    if (result.error) {
      setError(result.error)
      setImpersonating(false)
      return
    }
    router.push(roleRedirectPath(result.role, result.status))
  }

  async function handleToggleStatus() {
    const next = authStatus === 'approved' ? 'suspended' : 'approved'
    setTogglingStatus(true)
    setError('')
    const result = await ownerSetAccountStatus(person.id, next)
    setTogglingStatus(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setAuthStatus(next)
  }

  return (
    <div className="px-5 py-3.5 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <p className="text-sm font-medium text-primary truncate">{person.full_name}</p>
          <p className="text-xs text-secondary truncate">{person.email}</p>
          {(person.phone || person.position) && (
            <p className="text-xs text-tertiary truncate">
              {[person.phone, person.position].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Badge variant="gray">{person.role}</Badge>
        {statusBadge(authStatus)}
        <button
          type="button"
          onClick={() => setShowHistory(h => !h)}
          disabled={accessHistory.length === 0}
          className="text-right disabled:cursor-default"
        >
          {person.last_login_at ? (
            <>
              <p className="text-xs text-secondary font-medium">{relativeTime(person.last_login_at, t)}</p>
              <p className="text-[10px] text-tertiary">
                {new Date(person.last_login_at).toLocaleDateString(DATE_LOCALE[locale] ?? 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <p className="text-xs text-tertiary">{t('owner.companyDetail.never')}</p>
          )}
          <p className="text-[10px] text-tertiary">
            {accessesThisMonth} {t('owner.companyDetail.accessesThisMonth')}
            {accessHistory.length > 0 && (showHistory ? ' ▲' : ' ▼')}
          </p>
        </button>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className={[
              'px-2.5 py-1.5 rounded-button border text-xs font-medium transition-colors disabled:opacity-60',
              authStatus === 'approved'
                ? 'bg-danger/10 border-danger/25 text-danger hover:bg-danger/20'
                : 'bg-green/10 border-green/25 text-green hover:bg-green/20',
            ].join(' ')}
          >
            {authStatus === 'approved' ? t('owner.companyDetail.suspend') : t('owner.companyDetail.reactivate')}
          </button>
          <button
            onClick={() => { setResetting(r => !r); setSaved(false); setError('') }}
            className="px-2.5 py-1.5 rounded-button bg-surface-elevated border border-[var(--border)] text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            {t('owner.companyDetail.resetPassword')}
          </button>
          <button
            onClick={handleImpersonate}
            disabled={impersonating}
            className="px-2.5 py-1.5 rounded-button bg-brand/10 border border-brand/25 text-xs font-medium text-brand hover:bg-brand/20 transition-colors disabled:opacity-60"
          >
            {t('owner.companyDetail.impersonate')}
          </button>
        </div>
      </div>

      {showHistory && accessHistory.length > 0 && (
        <div className="pl-0 sm:pl-[calc(160px+0.75rem)] flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] text-tertiary uppercase tracking-wide w-full">{t('owner.companyDetail.recentAccesses')}</span>
          {accessHistory.map((iso, i) => (
            <span key={i} className="text-xs text-secondary">
              {new Date(iso).toLocaleDateString(DATE_LOCALE[locale] ?? 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          ))}
        </div>
      )}

      {resetting && (
        <div className="flex items-center gap-2 pl-0 sm:pl-[calc(160px+0.75rem)]">
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('owner.companyDetail.resetPasswordPlaceholder')}
            className="h-9 flex-1 max-w-xs rounded-input bg-surface-elevated border border-[var(--border)] px-3 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-colors"
          />
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-1.5 rounded-button bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors disabled:opacity-60"
          >
            {t('owner.companyDetail.resetPasswordSave')}
          </button>
          {saved && <span className="text-xs text-green">✓ {t('owner.companyDetail.resetPasswordSuccess')}</span>}
        </div>
      )}
      {error && <p className="text-xs text-danger pl-0 sm:pl-[calc(160px+0.75rem)]">{error}</p>}
    </div>
  )
}

export function PeopleTable({
  people,
  accessesThisMonth,
  accessHistory,
}: {
  people: Person[]
  accessesThisMonth: Record<string, number>
  accessHistory: Record<string, string[]>
}) {
  const { t, locale } = useTranslation()

  if (people.length === 0) {
    return <p className="px-5 py-8 text-sm text-secondary text-center">{t('owner.companyDetail.noPeople')}</p>
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {people.map(p => (
        <PersonRow
          key={p.id}
          person={p}
          locale={locale}
          t={t}
          accessesThisMonth={accessesThisMonth[p.id] ?? 0}
          accessHistory={accessHistory[p.id] ?? []}
        />
      ))}
    </div>
  )
}
