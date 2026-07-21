'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createProfileWithPassword } from '@/app/actions/admin-users'
import { useCompanyId } from '@/lib/company-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

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
}

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee' },
  { value: 'admin', label: 'Admin' },
  { value: 'client', label: 'Client (hotel)' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

const BLANK: Omit<Employee, 'id' | 'created_at'> & { password: string } = {
  full_name: '', email: '', role: 'employee', position: '',
  company_name: '', hourly_rate: 0, phone: '', status: 'active', password: '',
}

export default function EmployeesPage() {
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
    })
    setError('')
    setActivationUrl('')
    setShowModal(true)
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
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Employees</h1>
          <p className="text-sm text-secondary mt-1">
            {active} active · {clockedIn} clocked in now
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Employee</Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by name, email or position…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card padding="none">
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            {employees.length === 0 ? 'No employees yet. Add your first team member.' : 'No results for that search.'}
          </p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
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
                    {emp.role === 'admin' && <Badge variant="blue">Admin</Badge>}
                    {emp.status === 'archived' && <Badge variant="gray">Archived</Badge>}
                  </div>
                  <p className="text-xs text-secondary truncate">
                    {emp.position ?? 'No position'}
                    {emp.company_name ? ` · ${emp.company_name}` : ''}
                  </p>
                  <p className="text-xs text-tertiary truncate">{emp.email}</p>
                </div>
                <div className="hidden md:block text-right flex-shrink-0 mr-4">
                  <p className="text-sm font-semibold text-primary">
                    ${Number(emp.hourly_rate).toFixed(2)}/hr
                  </p>
                  {emp.phone && <p className="text-xs text-secondary">{emp.phone}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(emp)}
                    className="p-1.5 rounded-button text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
                    title="Edit"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleStatus(emp)}
                    className="p-1.5 rounded-button text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                    title={emp.status === 'active' ? 'Archive' : 'Activate'}
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
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold text-primary mb-5">
                {editing ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Input
                      label="Full Name"
                      required
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Email"
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  {!editing && form.role !== 'client' && (
                    <div className="col-span-2">
                      <Input
                        label="Password (for their login)"
                        type="text"
                        required
                        placeholder="At least 8 characters"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                      <p className="text-xs text-tertiary mt-1">Share this with them directly — it won&apos;t be shown again.</p>
                    </div>
                  )}
                  {!editing && form.role === 'client' && (
                    <div className="col-span-2 bg-brand/5 border border-brand/20 rounded-input p-3">
                      <p className="text-xs text-secondary">
                        Clients receive an activation link to set their own password. No password needed here.
                      </p>
                    </div>
                  )}
                  <Select
                    label="Role"
                    options={ROLE_OPTIONS}
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  />
                  <Select
                    label="Status"
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  />
                  <Input
                    label="Position / Trade"
                    placeholder="e.g. Painter, Electrician"
                    value={form.position ?? ''}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  />
                  <Input
                    label="Hourly Rate ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hourly_rate}
                    onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))}
                  />
                  <Input
                    label="Company (subcontractor)"
                    placeholder="Leave blank if direct hire"
                    value={form.company_name ?? ''}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                {activationUrl && (
                  <div className="bg-green/5 border border-green/20 rounded-input p-3 space-y-2">
                    <p className="text-xs font-semibold text-green">Client created! Share this activation link:</p>
                    <p className="text-xs font-mono text-secondary break-all select-all">{activationUrl}</p>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(activationUrl); setCopied('act') }}
                      className="text-xs text-brand hover:text-brand-hover font-medium transition-colors"
                    >
                      {copied === 'act' ? 'Copied!' : 'Copy link'}
                    </button>
                    <p className="text-xs text-tertiary">Link expires in 72 hours. You can regenerate it from the employee list.</p>
                  </div>
                )}

                {error && (
                  <div className="bg-danger/10 border border-danger/20 rounded-input px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    {activationUrl ? 'Done' : 'Cancel'}
                  </Button>
                  {!activationUrl && (
                    <Button type="submit" loading={saving} className="flex-1">
                      {editing ? 'Save Changes' : 'Add Employee'}
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
