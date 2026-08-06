'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createProfileWithPassword, adminSetPassword } from '@/app/actions/admin-users'
import { PERMISSION_KEYS, type EmployeePermissions } from '@/lib/permissions'
import { useCompanyId } from '@/lib/company-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/lib/i18n/LocaleContext'

interface Employee {
  id: string
  full_name: string
  email: string
  role: string
  position: string | null
  company_name: string | null
  hourly_rate: number
  phone: string | null
  status: string
  created_at: string
  permissions: EmployeePermissions | null
}

const BLANK: Omit<Employee, 'id' | 'created_at'> & { password: string } = {
  full_name: '', email: '', role: 'employee', position: '',
  company_name: '', hourly_rate: 0, phone: '', status: 'active', password: '',
  permissions: {},
}

export default function EmployeesPage() {
  const { t } = useTranslation()
  const companyId = useCompanyId()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [activationUrl, setActivationUrl] = useState('')
  const [copied, setCopied] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  const ROLE_OPTIONS = [
    { value: 'employee', label: t('admin.employees.roleEmployee') },
    { value: 'admin', label: t('admin.employees.roleAdmin') },
    { value: 'client', label: t('admin.employees.roleClient') },
  ]

  const STATUS_OPTIONS = [
    { value: 'active', label: t('common.active') },
    { value: 'archived', label: t('admin.employees.statusArchived') },
  ]

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: emps }, { data: open }] = await Promise.all([
      supabase.from('profiles').select('*').eq('company_id', companyId).order('full_name'),
      supabase.from('time_entries').select('employee_id').is('clock_out', null),
    ])
    setEmployees(emps ?? [])
    setOpenIds(new Set((open ?? []).map((e: { employee_id: string }) => e.employee_id)))
    setLoading(false)
  }, [companyId])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ ...BLANK })
    setError('')
    setActivationUrl('')
    setShowResetPassword(false)
    setResetPasswordValue('')
    setResetError('')
    setResetSuccess(false)
    setShowModal(true)
  }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      role: emp.role,
      position: emp.position ?? '',
      company_name: emp.company_name ?? '',
      hourly_rate: emp.hourly_rate,
      phone: emp.phone ?? '',
      status: emp.status,
      password: '',
      permissions: emp.permissions ?? {},
    })
    setError('')
    setActivationUrl('')
    setShowResetPassword(false)
    setResetPasswordValue('')
    setResetError('')
    setResetSuccess(false)
    setShowModal(true)
  }

  async function handleResetPassword() {
    if (!editing) return
    setResetError('')
    setResettingPassword(true)
    const result = await adminSetPassword(editing.id, resetPasswordValue)
    setResettingPassword(false)
    if (result.error) {
      setResetError(result.error)
      return
    }
    setResetSuccess(true)
    setResetPasswordValue('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    if (editing) {
      const supabase = createClient()
      await supabase.from('profiles').update({
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        position: form.position || null,
        company_name: form.company_name || null,
        hourly_rate: Number(form.hourly_rate),
        phone: form.phone || null,
        status: form.status,
        permissions: form.role === 'employee' ? (form.permissions ?? {}) : {},
      }).eq('id', editing.id)
    } else {
      // Creating a login needs the password hashed server-side.
      const result = await createProfileWithPassword({
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        position: form.position || null,
        company_name: form.company_name || null,
        hourly_rate: Number(form.hourly_rate),
        phone: form.phone || null,
        password: form.password,
        permissions: form.permissions ?? {},
      })
      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }
      // Client was created — show their activation link before closing.
      if (result.activationUrl) {
        setActivationUrl(result.activationUrl)
        setSaving(false)
        load()
        return
      }
    }

    setSaving(false)
    setShowModal(false)
    load()
  }

  async function toggleStatus(emp: Employee) {
    const supabase = createClient()
    const next = emp.status === 'active' ? 'archived' : 'active'
    await supabase.from('profiles').update({ status: next }).eq('id', emp.id)
    load()
  }

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.position ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const active = employees.filter(e => e.status === 'active').length
  const clockedIn = employees.filter(e => openIds.has(e.id)).length

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">{t('admin.employees.title')}</h1>
          <p className="text-sm text-secondary mt-1">
            {t('admin.employees.summary').replace('{n}', String(active)).replace('{m}', String(clockedIn))}
          </p>
        </div>
        <Button onClick={openAdd}>{t('admin.employees.addEmployee')}</Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder={t('admin.employees.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card padding="none">
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            {employees.length === 0 ? t('admin.employees.noEmployeesYet') : t('admin.employees.noResultsForSearch')}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 px-5 py-4">
                <div className="relative flex-shrink-0">
                  <Avatar name={emp.full_name} size="md" />
                  {openIds.has(emp.id) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-primary truncate">{emp.full_name}</p>
                    {emp.role === 'admin' && <Badge variant="blue">{t('admin.employees.roleAdmin')}</Badge>}
                    {emp.status === 'archived' && <Badge variant="gray">{t('admin.employees.statusArchived')}</Badge>}
                  </div>
                  <p className="text-xs text-secondary truncate">
                    {emp.position ?? t('admin.employees.noPosition')}
                    {emp.company_name ? ` · ${emp.company_name}` : ''}
                  </p>
                  <p className="text-xs text-tertiary truncate">{emp.email}</p>
                </div>
                <div className="hidden md:block text-right flex-shrink-0 mr-4">
                  <p className="text-sm font-semibold text-primary">
                    ${Number(emp.hourly_rate).toFixed(2)}{t('admin.employees.perHour')}
                  </p>
                  {emp.phone && <p className="text-xs text-secondary">{emp.phone}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(emp)}
                    className="p-1.5 rounded-button text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
                    title={t('admin.employees.editTooltip')}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleStatus(emp)}
                    className="p-1.5 rounded-button text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                    title={emp.status === 'active' ? t('admin.employees.archiveTooltip') : t('admin.employees.activateTooltip')}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      {emp.status === 'active'
                        ? <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.476 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      }
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-surface rounded-card border border-[var(--border)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold text-primary mb-5">
                {editing ? t('admin.employees.editEmployee') : t('admin.employees.addEmployeeTitle')}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Input
                      label={t('admin.employees.fullName')}
                      required
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label={t('admin.employees.email')}
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  {!editing && form.role !== 'client' && (
                    <div className="col-span-2">
                      <Input
                        label={t('admin.employees.passwordLabel')}
                        type="text"
                        required
                        placeholder={t('admin.employees.passwordPlaceholder')}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                      <p className="text-xs text-tertiary mt-1">{t('admin.employees.passwordHint')}</p>
                    </div>
                  )}
                  {!editing && form.role === 'client' && (
                    <div className="col-span-2 bg-brand/5 border border-brand/20 rounded-input p-3">
                      <p className="text-xs text-secondary">
                        {t('admin.employees.clientActivationHint')}
                      </p>
                    </div>
                  )}
                  <Select
                    label={t('admin.employees.role')}
                    options={ROLE_OPTIONS}
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  />
                  <Select
                    label={t('admin.employees.status')}
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  />
                  {form.role === 'employee' && (
                    <div className="col-span-2 bg-surface-elevated border border-[var(--border)] rounded-input p-3">
                      <p className="text-xs font-semibold text-secondary mb-2">{t('admin.employees.permissionsTitle')}</p>
                      <div className="space-y-2">
                        {PERMISSION_KEYS.map(key => (
                          <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.permissions?.[key] === true}
                              onChange={e =>
                                setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }))
                              }
                              className="w-4 h-4 rounded accent-brand flex-shrink-0"
                            />
                            <span className="text-sm text-primary">{t(`admin.employees.permission_${key}`)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {editing && (form.role === 'employee' || form.role === 'admin') && (
                    <div className="col-span-2 bg-surface-elevated border border-[var(--border)] rounded-input p-3">
                      {!showResetPassword ? (
                        <button
                          type="button"
                          onClick={() => { setShowResetPassword(true); setResetSuccess(false) }}
                          className="text-xs text-brand hover:text-brand-hover font-medium transition-colors"
                        >
                          {t('admin.employees.resetPasswordLink')}
                        </button>
                      ) : resetSuccess ? (
                        <p className="text-xs text-green">{t('admin.employees.resetPasswordSuccess')}</p>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            label={t('admin.employees.resetPasswordLabel')}
                            type="text"
                            placeholder={t('admin.employees.passwordPlaceholder')}
                            value={resetPasswordValue}
                            onChange={e => setResetPasswordValue(e.target.value)}
                          />
                          {resetError && <p className="text-xs text-danger">{resetError}</p>}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            loading={resettingPassword}
                            onClick={handleResetPassword}
                          >
                            {t('admin.employees.resetPasswordSave')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <Input
                    label={t('admin.employees.positionLabel')}
                    placeholder={t('admin.employees.positionPlaceholder')}
                    value={form.position ?? ''}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  />
                  <Input
                    label={t('admin.employees.hourlyRateLabel')}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hourly_rate}
                    onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))}
                  />
                  <Input
                    label={t('admin.employees.companyLabel')}
                    placeholder={t('admin.employees.companyPlaceholder')}
                    value={form.company_name ?? ''}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                  />
                  <Input
                    label={t('admin.employees.phone')}
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                {activationUrl && (
                  <div className="bg-green/5 border border-green/20 rounded-input p-3 space-y-2">
                    <p className="text-xs font-semibold text-green">{t('admin.employees.clientCreated')}</p>
                    <p className="text-xs font-mono text-secondary break-all select-all">{activationUrl}</p>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(activationUrl); setCopied('act') }}
                      className="text-xs text-brand hover:text-brand-hover font-medium transition-colors"
                    >
                      {copied === 'act' ? t('admin.employees.copied') : t('admin.employees.copyLink')}
                    </button>
                    <p className="text-xs text-tertiary">{t('admin.employees.linkExpires')}</p>
                  </div>
                )}

                {error && (
                  <div className="bg-danger/10 border border-danger/20 rounded-input px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    {activationUrl ? t('admin.employees.done') : t('common.cancel')}
                  </Button>
                  {!activationUrl && (
                    <Button type="submit" loading={saving} className="flex-1">
                      {editing ? t('admin.employees.saveChanges') : t('admin.employees.addEmployeeTitle')}
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
