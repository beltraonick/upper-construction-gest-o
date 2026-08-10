'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompanyBilling } from '@/app/actions/owner'
import { Input } from '@/components/ui/Input'
import { useTranslation } from '@/lib/i18n/LocaleContext'

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled'] as const

export function BillingForm({
  companyId,
  initialStatus,
  initialMonthsOverdue,
  initialNotes,
}: {
  companyId: string
  initialStatus: string
  initialMonthsOverdue: number
  initialNotes: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [monthsOverdue, setMonthsOverdue] = useState(String(initialMonthsOverdue))
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    const result = await updateCompanyBilling(companyId, {
      subscription_status: status,
      months_overdue: Math.max(0, parseInt(monthsOverdue, 10) || 0),
      owner_notes: notes,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-secondary">{t('owner.companyDetail.statusLabel')}</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-11 w-full rounded-input bg-surface-elevated border border-[var(--border)] px-4 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-colors"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <Input
          label={t('owner.companyDetail.monthsOverdueLabel')}
          type="number"
          min={0}
          value={monthsOverdue}
          onChange={e => setMonthsOverdue(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-secondary">{t('owner.companyDetail.notesLabel')}</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('owner.companyDetail.notesPlaceholder')}
          rows={3}
          className="w-full rounded-input bg-surface-elevated border border-[var(--border)] px-4 py-2.5 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-colors resize-none"
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-button bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-60"
        >
          {t('owner.companyDetail.saveBilling')}
        </button>
        {saved && <span className="text-xs text-green">✓ {t('owner.companyDetail.billingSaved')}</span>}
      </div>
    </div>
  )
}
