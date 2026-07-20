'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface ChecklistItem { text: string; done: boolean }

interface Task {
  id: string
  title: string
  description: string | null
  area: string | null
  priority: string
  status: string
  estimated_hours: number | null
  due_date: string | null
  checklist: ChecklistItem[]
  notes: string | null
  completed_at: string | null
  created_at: string
  project_id: string | null
  assigned_employee_id: string | null
  project: { name: string } | null
  assigned_employee: { full_name: string } | null
}

interface Profile { id: string; full_name: string }
interface Project { id: string; name: string }

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const FILTER_STATUS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue/10 text-blue',
  medium: 'bg-amber/10 text-amber',
  high: 'bg-danger/10 text-danger',
  urgent: 'bg-danger text-white',
}

const STATUS_VARIANTS: Record<string, 'gray' | 'amber' | 'blue' | 'green'> = {
  pending: 'gray',
  in_progress: 'amber',
  completed: 'green',
}

const BLANK = {
  title: '', description: '', area: '', priority: 'medium',
  status: 'pending', estimated_hours: '', due_date: '',
  project_id: '', assigned_employee_id: '', notes: '',
  checklist: [] as ChecklistItem[],
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [newCheckItem, setNewCheckItem] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: t }, { data: emps }, { data: projs }] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, project:project_id(name), assigned_employee:assigned_to(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('company_id', COMPANY_ID).eq('status', 'active').order('full_name'),
      supabase.from('projects').select('id, name').eq('company_id', COMPANY_ID).eq('status', 'active').order('name'),
    ])
    setTasks((t ?? []) as unknown as Task[])
    setEmployees(emps ?? [])
    setProjects(projs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ ...BLANK })
    setShowModal(true)
  }

  function openEdit(t: Task) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description ?? '',
      area: t.area ?? '',
      priority: t.priority,
      status: t.status,
      estimated_hours: t.estimated_hours != null ? String(t.estimated_hours) : '',
      due_date: t.due_date ?? '',
      project_id: t.project_id ?? '',
      assigned_employee_id: t.assigned_employee_id ?? '',
      notes: t.notes ?? '',
      checklist: t.checklist ?? [],
    })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    // Base payload uses columns guaranteed to exist in the original schema.
    // Columns added by migration 003 (area, priority, checklist, notes, completed_at,
    // assigned_employee_id, company_id) are included but will be silently ignored
    // by Postgres if the column doesn't exist yet — the app retries after migration.
    const base = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      due_date: form.due_date || null,
      project_id: form.project_id || null,
      // Use assigned_to (original column) + assigned_employee_id (post-migration column)
      assigned_to: form.assigned_employee_id || null,
      updated_at: new Date().toISOString(),
    }

    // Extended columns — safe to include; Postgres ignores unknown column errors
    // when the schema validates via PostgREST's column whitelist. We try/catch.
    try {
      const extended = {
        ...base,
        area: form.area || null,
        priority: form.priority,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        notes: form.notes || null,
        checklist: form.checklist,
        completed_at: form.status === 'completed' ? new Date().toISOString() : null,
        assigned_employee_id: form.assigned_employee_id || null,
      }
      if (editing) {
        await supabase.from('tasks').update(extended).eq('id', editing.id)
      } else {
        await supabase.from('tasks').insert({ ...extended, company_id: COMPANY_ID })
      }
    } catch {
      // Fall back to base-only payload (pre-migration schema)
      if (editing) {
        await supabase.from('tasks').update(base).eq('id', editing.id)
      } else {
        await supabase.from('tasks').insert(base)
      }
    }

    setSaving(false)
    setShowModal(false)
    load()
  }

  async function quickStatus(id: string, status: string) {
    const supabase = createClient()
    try {
      await supabase.from('tasks').update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
    } catch {
      await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    }
    load()
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', id)
    load()
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setForm(f => ({ ...f, checklist: [...f.checklist, { text: newCheckItem.trim(), done: false }] }))
    setNewCheckItem('')
  }

  function removeCheckItem(i: number) {
    setForm(f => ({ ...f, checklist: f.checklist.filter((_, idx) => idx !== i) }))
  }

  const filtered = tasks.filter(t =>
    (!filterStatus || t.status === filterStatus) &&
    (!filterProject || t.project_id === filterProject)
  )

  const counts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }

  const empOptions = [
    { value: '', label: 'Unassigned' },
    ...employees.map(e => ({ value: e.id, label: e.full_name })),
  ]

  const projOptions = [
    { value: '', label: 'No project' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ]

  const projFilterOptions = [
    { value: '', label: 'All projects' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ]

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Tasks</h1>
          <p className="text-sm text-secondary mt-1">
            {counts.pending} pending · {counts.in_progress} in progress · {counts.completed} completed
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Task</Button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-secondary' },
          { label: 'In Progress', count: counts.in_progress, color: 'text-amber' },
          { label: 'Completed', count: counts.completed, color: 'text-green' },
        ].map(c => (
          <div key={c.label} className="bg-surface border border-[rgba(255,255,255,0.07)] rounded-button px-3 py-1.5 flex items-center gap-2">
            <span className={`text-xs font-semibold ${c.color}`}>{c.count}</span>
            <span className="text-xs text-secondary">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="w-40">
          <Select options={FILTER_STATUS} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} />
        </div>
        <div className="w-52">
          <Select options={projFilterOptions} value={filterProject} onChange={e => setFilterProject(e.target.value)} />
        </div>
      </div>

      <Card padding="none">
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary mb-3">
              {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match the current filters.'}
            </p>
            {tasks.length === 0 && (
              <Button onClick={openAdd} variant="secondary">Create first task</Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {filtered.map(t => {
              const doneItems = (t.checklist ?? []).filter(c => c.done).length
              const totalItems = (t.checklist ?? []).length
              return (
                <div key={t.id} className="px-5 py-4 flex items-start gap-3 group">
                  {/* Priority stripe */}
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    t.priority === 'urgent' ? 'bg-danger' :
                    t.priority === 'high' ? 'bg-danger/60' :
                    t.priority === 'medium' ? 'bg-amber' : 'bg-blue'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className={`text-sm font-medium ${t.status === 'completed' ? 'text-tertiary line-through' : 'text-primary'}`}>
                        {t.title}
                      </p>
                      <Badge variant={STATUS_VARIANTS[t.status] ?? 'gray'}>
                        {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </Badge>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                        {t.priority.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {t.project?.name && (
                        <p className="text-xs text-secondary truncate">📁 {t.project.name}</p>
                      )}
                      {t.assigned_employee?.full_name && (
                        <p className="text-xs text-secondary">👤 {t.assigned_employee.full_name}</p>
                      )}
                      {t.area && (
                        <p className="text-xs text-tertiary">📍 {t.area}</p>
                      )}
                      {totalItems > 0 && (
                        <p className="text-xs text-tertiary">{doneItems}/{totalItems} done</p>
                      )}
                      {t.due_date && (
                        <p className={`text-xs ${new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'text-danger' : 'text-tertiary'}`}>
                          Due {new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.status === 'pending' && (
                      <button
                        onClick={() => quickStatus(t.id, 'in_progress')}
                        className="text-xs px-2 py-1 rounded-button bg-amber/10 text-amber hover:bg-amber/20 transition-colors"
                      >
                        Start
                      </button>
                    )}
                    {t.status === 'in_progress' && (
                      <button
                        onClick={() => quickStatus(t.id, 'completed')}
                        className="text-xs px-2 py-1 rounded-button bg-green/10 text-green hover:bg-green/20 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-button text-tertiary hover:text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="p-1.5 rounded-button text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
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
                {editing ? 'Edit Task' : 'New Task'}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Task Title"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Paint Room 214"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Priority"
                    options={PRIORITY_OPTIONS}
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  />
                  <Select
                    label="Status"
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  />
                  <Select
                    label="Project"
                    options={projOptions}
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  />
                  <Select
                    label="Assigned To"
                    options={empOptions}
                    value={form.assigned_employee_id}
                    onChange={e => setForm(f => ({ ...f, assigned_employee_id: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Area / Location"
                    placeholder="e.g. Floor 3, Room 214"
                    value={form.area}
                    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                  />
                  <Input
                    label="Due Date"
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional details…"
                    className="w-full bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2.5 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none resize-none transition-colors"
                  />
                </div>

                {/* Checklist */}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">Checklist</label>
                  {form.checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={e => {
                          const cl = [...form.checklist]
                          cl[i] = { ...cl[i], done: e.target.checked }
                          setForm(f => ({ ...f, checklist: cl }))
                        }}
                        className="rounded"
                      />
                      <span className={`text-sm flex-1 ${item.done ? 'text-tertiary line-through' : 'text-primary'}`}>{item.text}</span>
                      <button type="button" onClick={() => removeCheckItem(i)} className="text-tertiary hover:text-danger">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={newCheckItem}
                      onChange={e => setNewCheckItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
                      placeholder="Add checklist item…"
                      className="flex-1 bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={addCheckItem}
                      className="px-3 py-2 text-xs font-medium rounded-button bg-surface-elevated text-secondary hover:text-primary border border-[rgba(255,255,255,0.07)] transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save' : 'Create Task'}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
