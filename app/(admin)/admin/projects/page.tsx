'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/lib/company-context'
import { checkProjectLimit } from '@/lib/plan-limits'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/lib/i18n/LocaleContext'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

interface Project {
  id: string
  name: string
  status: string
  city: string | null
  state: string | null
  hotel_name: string | null
  leader_id: string | null
  budget: number | null
  client_name: string | null
  client_email: string | null
  created_at: string
}

interface Profile {
  id: string
  full_name: string
}

const BLANK = {
  name: '', status: 'active', city: '', state: '',
  hotel_name: '', leader_id: '', budget: '', client_name: '', client_email: '',
}

function statusBadge(s: string, t: (key: string) => string) {
  if (s === 'active') return <Badge variant="green">{t('common.active')}</Badge>
  if (s === 'completed') return <Badge variant="blue">{t('common.completed')}</Badge>
  return <Badge variant="amber">{t('admin.projects.statusOnHold')}</Badge>
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const companyId = useCompanyId()
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const STATUS_OPTIONS = [
    { value: 'active', label: t('common.active') },
    { value: 'completed', label: t('common.completed') },
    { value: 'on_hold', label: t('admin.projects.statusOnHold') },
  ]

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: projs }, { data: emps }] = await Promise.all([
      supabase.from('projects').select('id, name, status, city, state, hotel_name, leader_id, budget, client_name, client_email, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('company_id', companyId).eq('status', 'active').order('full_name'),
    ])
    setProjects(projs ?? [])
    setEmployees(emps ?? [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ ...BLANK })
    setError('')
    setShowModal(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setForm({
      name: p.name,
      status: p.status,
      city: p.city ?? '',
      state: p.state ?? '',
      hotel_name: p.hotel_name ?? '',
      leader_id: p.leader_id ?? '',
      budget: p.budget != null ? String(p.budget) : '',
      client_name: p.client_name ?? '',
      client_email: p.client_email ?? '',
    })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name,
      status: form.status,
      city: form.city || null,
      state: form.state || null,
      hotel_name: form.hotel_name || null,
      leader_id: form.leader_id || null,
      budget: form.budget ? Number(form.budget) : null,
      client_name: form.client_name || null,
      client_email: form.client_email ? form.client_email.trim().toLowerCase() : null,
    }
    if (editing) {
      await supabase.from('projects').update(payload).eq('id', editing.id)
    } else {
      const { allowed, limit } = await checkProjectLimit(supabase, companyId)
      if (!allowed) {
        setError(t('admin.projects.planLimitError').replace('{n}', String(limit)))
        setSaving(false)
        return
      }
      await supabase.from('projects').insert({ ...payload, company_id: companyId })
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  const stateOptions = [
    { value: '', label: t('admin.projects.selectState') },
    ...US_STATES.map(s => ({ value: s, label: s })),
  ]

  const leaderOptions = [
    { value: '', label: t('admin.projects.noLeaderAssigned') },
    ...employees.map(e => ({ value: e.id, label: e.full_name })),
  ]

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.state ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const active = projects.filter(p => p.status === 'active').length

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">{t('admin.projects.title')}</h1>
          <p className="text-sm text-secondary mt-1">
            {t('admin.projects.summary').replace('{n}', String(active)).replace('{m}', String(projects.length))}
          </p>
        </div>
        <Button onClick={openAdd}>{t('admin.projects.addProject')}</Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder={t('admin.projects.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card padding="none">
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            {projects.length === 0 ? t('admin.projects.noProjectsYet') : t('admin.projects.noResults')}
          </p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {filtered.map(p => {
              const leader = employees.find(e => e.id === p.leader_id)
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 rounded-button bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-brand">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-primary truncate">{p.name}</p>
                      {statusBadge(p.status, t)}
                    </div>
                    <p className="text-xs text-secondary truncate">
                      {[p.city, p.state].filter(Boolean).join(', ') || t('admin.projects.noLocation')}
                      {p.hotel_name ? ` · ${p.hotel_name}` : ''}
                    </p>
                    {leader && (
                      <p className="text-xs text-tertiary truncate">{t('admin.projects.leaderPrefix').replace('{n}', leader.full_name)}</p>
                    )}
                    {p.client_email ? (
                      <p className="text-xs text-tertiary truncate">{t('admin.projects.clientPrefix').replace('{n}', p.client_name || p.client_email)}</p>
                    ) : (
                      <p className="text-xs text-amber truncate">{t('admin.projects.noClientLinked')}</p>
                    )}
                  </div>
                  <div className="hidden md:flex flex-col items-end flex-shrink-0 mr-4">
                    {p.budget != null && (
                      <p className="text-sm font-semibold text-primary">
                        ${Number(p.budget).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <a
                    href={`/admin/projects/${p.id}`}
                    className="p-1.5 rounded-button text-secondary hover:text-primary hover:bg-surface-elevated transition-colors flex-shrink-0"
                    title={t('admin.projects.viewDetailTooltip')}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-button text-secondary hover:text-primary hover:bg-surface-elevated transition-colors flex-shrink-0"
                    title={t('admin.projects.editTooltip')}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold text-primary mb-5">
                {editing ? t('admin.projects.editProject') : t('admin.projects.addProjectTitle')}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Input
                      label={t('admin.projects.projectName')}
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <Input
                    label={t('admin.projects.city')}
                    placeholder={t('admin.projects.cityPlaceholder')}
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  />
                  <Select
                    label={t('admin.projects.state')}
                    options={stateOptions}
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  />
                  <div className="col-span-2">
                    <Input
                      label={t('admin.projects.hotelAccommodation')}
                      placeholder={t('admin.projects.hotelPlaceholder')}
                      value={form.hotel_name}
                      onChange={e => setForm(f => ({ ...f, hotel_name: e.target.value }))}
                    />
                  </div>
                  <Select
                    label={t('admin.projects.leader')}
                    options={leaderOptions}
                    value={form.leader_id}
                    onChange={e => setForm(f => ({ ...f, leader_id: e.target.value }))}
                  />
                  <Select
                    label={t('admin.projects.status')}
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  />
                  <div className="col-span-2">
                    <Input
                      label={t('admin.projects.budget')}
                      type="number"
                      min="0"
                      step="100"
                      placeholder={t('admin.projects.budgetPlaceholder')}
                      value={form.budget}
                      onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 pt-2 border-t border-[rgba(255,255,255,0.07)]">
                    <p className="text-xs font-medium text-secondary mb-3">{t('admin.projects.clientAccess')}</p>
                  </div>
                  <Input
                    label={t('admin.projects.clientHotelName')}
                    placeholder={t('admin.projects.clientHotelPlaceholder')}
                    value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  />
                  <Input
                    label={t('admin.projects.clientLoginEmail')}
                    type="email"
                    placeholder={t('admin.projects.clientEmailPlaceholder')}
                    value={form.client_email}
                    onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-tertiary -mt-2">
                  {t('admin.projects.clientAccessHint')}
                </p>
                {error && (
                  <div className="bg-danger/10 border border-danger/20 rounded-input px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" loading={saving} className="flex-1">
                    {editing ? t('admin.projects.saveChanges') : t('admin.projects.addProjectTitle')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
