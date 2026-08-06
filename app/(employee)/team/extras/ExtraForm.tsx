'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/lib/i18n/LocaleContext'

export interface ExtraProject {
  id: string
  name: string
}

export interface ExtraOrder {
  id: string
  title: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  project?: { name: string } | null
}

function statusBadge(s: string, t: (key: string) => string) {
  if (s === 'approved') return <Badge variant="green">{t('common.approved')}</Badge>
  if (s === 'rejected') return <Badge variant="red">{t('common.rejected')}</Badge>
  return <Badge variant="amber">{t('common.pending')}</Badge>
}

export function ExtraForm({
  profileId,
  companyId,
  projects,
  initialOrders,
  supabaseReady,
}: {
  profileId: string | null
  companyId: string
  projects: ExtraProject[]
  initialOrders: ExtraOrder[]
  supabaseReady: boolean
}) {
  const { t } = useTranslation()
  const [orders, setOrders] = useState(initialOrders)
  const [form, setForm] = useState({ project_id: projects[0]?.id ?? '', title: '', description: '', amount: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id || !form.title.trim() || !profileId || !supabaseReady) return
    setSaving(true)
    setSuccess(false)

    const supabase = createClient()
    const { data } = await supabase
      .from('change_orders')
      .insert({
        company_id: companyId,
        project_id: form.project_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        amount: form.amount ? Number(form.amount) : 0,
        status: 'pending',
        created_by: profileId,
      })
      .select('id, title, amount, status, created_at, project:project_id(name)')
      .single()

    if (data) {
      setOrders(prev => [data as unknown as ExtraOrder, ...prev])
      setForm({ project_id: form.project_id, title: '', description: '', amount: '' })
      setSuccess(true)
    }
    setSaving(false)
  }

  if (projects.length === 0) {
    return (
      <Card>
        <p className="text-sm text-secondary text-center py-6">{t('employee.team.noProjectsAssigned')}</p>
      </Card>
    )
  }

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }))

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label={t('admin.changeOrders.project')}
            options={projectOptions}
            value={form.project_id}
            onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
          />
          <Input
            label={t('admin.changeOrders.titleLabel')}
            placeholder={t('admin.changeOrders.titlePlaceholder')}
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-secondary">{t('admin.changeOrders.description')}</label>
            <textarea
              className="w-full rounded-input bg-surface-elevated border border-[var(--border)] px-4 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Input
            label={t('admin.changeOrders.amountLabel')}
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          {success && <p className="text-xs text-green">{t('employee.team.extraSentSuccess')}</p>}
          <Button type="submit" loading={saving} className="w-full">
            {t('admin.changeOrders.sendToClient')}
          </Button>
        </form>
      </Card>

      {orders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-primary mb-3">{t('employee.team.recentExtras')}</h2>
          <div className="space-y-2">
            {orders.map(o => (
              <Card key={o.id} padding="sm" className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{o.title}</p>
                  <p className="text-xs text-secondary truncate">{o.project?.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    ${Number(o.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  {statusBadge(o.status, t)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
