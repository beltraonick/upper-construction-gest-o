'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface ChangeOrder {
  id: string
  project_id: string
  title: string
  description: string | null
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  client_comment: string | null
  decided_at: string | null
  created_at: string
  project?: { name: string; client_name: string | null } | null
}

interface Project {
  id: string
  name: string
  client_name: string | null
  client_email: string | null
}

const BLANK = { project_id: '', title: '', description: '', amount: '' }

function statusBadge(s: string) {
  if (s === 'approved') return <Badge variant="green">Approved</Badge>
  if (s === 'rejected') return <Badge variant="red">Rejected</Badge>
  return <Badge variant="amber">Pending client review</Badge>
}

export default function ChangeOrdersPage() {
  const [orders, setOrders] = useState<ChangeOrder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...BLANK })
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: cos }, { data: projs }] = await Promise.all([
      supabase
        .from('change_orders')
        .select('*, project:project_id(name, client_name)')
        .eq('company_id', COMPANY_ID)
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, name, client_name, client_email')
        .eq('company_id', COMPANY_ID)
        .order('name'),
    ])
    setOrders((cos ?? []) as unknown as ChangeOrder[])
    setProjects(projs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setForm({ ...BLANK, project_id: projects[0]?.id ?? '' })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('change_orders').insert({
      company_id: COMPANY_ID,
      project_id: form.project_id,
      title: form.title,
      description: form.description || null,
      amount: form.amount ? Number(form.amount) : 0,
      status: 'pending',
    })
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function deleteOrder(id: string) {
    if (!window.confirm('Delete this change order? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('change_orders').delete().eq('id', id)
    load()
  }

  const projectOptions = projects.map(p => ({
    value: p.id,
    label: p.client_email ? p.name : `${p.name} (no client linked)`,
  }))

  const filtered = statusFilter ? orders.filter(o => o.status === statusFilter) : orders
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const approvedTotal = orders.filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.amount), 0)

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Change Orders</h1>
          <p className="text-sm text-secondary mt-1">
            {pendingCount} awaiting client · ${approvedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} approved
          </p>
        </div>
        <Button onClick={openAdd} disabled={projects.length === 0}>+ New Extra</Button>
      </div>

      {projects.length === 0 && !loading && (
        <div className="mb-5 bg-amber/5 border border-amber/20 rounded-card px-4 py-3 text-sm text-amber">
          Create a project first before adding change orders.
        </div>
      )}

      <div className="mb-4 w-52">
        <Select options={statusOptions} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
      </div>

      <Card padding="none">
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            {orders.length === 0 ? 'No change orders yet.' : 'No results for that filter.'}
          </p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {filtered.map(o => (
              <div key={o.id} className="flex items-start gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-primary truncate">{o.title}</p>
                    {statusBadge(o.status)}
                  </div>
                  <p className="text-xs text-secondary mt-0.5 truncate">
                    {o.project?.name ?? 'Unknown project'}
                    {o.project?.client_name ? ` · ${o.project.client_name}` : ''}
                  </p>
                  {o.description && <p className="text-xs text-tertiary mt-1">{o.description}</p>}
                  {o.client_comment && (
                    <p className="text-xs text-blue mt-1.5 italic">&ldquo;{o.client_comment}&rdquo;</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                  <p className="text-sm font-semibold text-primary">
                    ${Number(o.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  {o.status === 'pending' && (
                    <button
                      onClick={() => deleteOrder(o.id)}
                      className="text-xs text-tertiary hover:text-danger transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
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
              <h2 className="text-base font-semibold text-primary mb-5">New Change Order</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <Select
                  label="Project"
                  options={projectOptions}
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                />
                <Input
                  label="Title"
                  placeholder="e.g. Replace damaged drywall in Room 204"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-secondary">Description</label>
                  <textarea
                    className="w-full rounded-input bg-surface-elevated border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <Input
                  label="Amount ($)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving} className="flex-1">
                    Send to Client
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
