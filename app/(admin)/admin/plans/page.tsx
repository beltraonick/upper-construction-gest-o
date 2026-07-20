'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/lib/company-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

const BUCKET = 'project-photos'

interface Project { id: string; name: string }
interface Plan { id: string; project_id: string; label: string; storage_path: string }
interface PinnedTask {
  id: string
  title: string
  status: string
  priority: string
  description: string | null
  pin_x: number
  pin_y: number
}

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-green',
  in_progress: 'bg-amber',
  pending: 'bg-[rgba(255,255,255,0.5)]',
  blocked: 'bg-danger',
}

const BLANK = { title: '', description: '', priority: 'medium' }

export default function PlansPage() {
  const companyId = useCompanyId()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [pins, setPins] = useState<PinnedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null)
  const [selectedPin, setSelectedPin] = useState<PinnedTask | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const fileRef = useRef<HTMLInputElement>(null)
  const imgWrapRef = useRef<HTMLDivElement>(null)

  const loadProjects = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('projects').select('id, name').eq('company_id', companyId).order('name')
    setProjects(data ?? [])
    if (data && data.length > 0 && !projectId) setProjectId(data[0].id)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const loadPlan = useCallback(async (pid: string) => {
    if (!pid) { setPlan(null); setPins([]); return }
    const supabase = createClient()
    const { data: planRow } = await supabase
      .from('project_plans')
      .select('id, project_id, label, storage_path')
      .eq('project_id', pid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setPlan(planRow ?? null)
    if (planRow) {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(planRow.storage_path)
      setImageUrl(urlData.publicUrl)
      const { data: taskRows } = await supabase
        .from('tasks')
        .select('id, title, status, priority, description, pin_x, pin_y')
        .eq('plan_id', planRow.id)
      setPins((taskRows ?? []) as PinnedTask[])
    } else {
      setImageUrl('')
      setPins([])
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { if (projectId) loadPlan(projectId) }, [projectId, loadPlan])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !projectId) return
    setUploading(true)
    const supabase = createClient()
    const file = files[0]
    const ext = file.name.split('.').pop()
    const path = `plans/${projectId}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file)
    if (!uploadErr) {
      await supabase.from('project_plans').insert({
        project_id: projectId,
        company_id: companyId,
        storage_path: path,
      })
      await loadPlan(projectId)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function replacePlan() {
    if (!window.confirm('Replace this plan? Existing pins stay linked to the old plan and will disappear from view.')) return
    fileRef.current?.click()
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgWrapRef.current) return
    const rect = imgWrapRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPendingCoords({ x, y })
    setForm({ ...BLANK })
  }

  async function saveNewPin(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingCoords || !plan) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tasks').insert({
      company_id: companyId,
      project_id: projectId,
      plan_id: plan.id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      status: 'pending',
      pin_x: pendingCoords.x,
      pin_y: pendingCoords.y,
    })
    setSaving(false)
    setPendingCoords(null)
    loadPlan(projectId)
  }

  async function quickStatus(taskId: string, status: string) {
    const supabase = createClient()
    await supabase.from('tasks').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId)
    setSelectedPin(null)
    loadPlan(projectId)
  }

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }))
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Floor Plans</h1>
          <p className="text-sm text-secondary mt-1">Upload a plan image and click to pin tasks exactly where the work is</p>
        </div>
      </div>

      <div className="mb-5 w-64">
        <Select label="Project" options={projectOptions} value={projectId} onChange={e => setProjectId(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-sm text-secondary text-center py-16">Loading…</p>
      ) : projects.length === 0 ? (
        <Card><p className="text-sm text-secondary text-center py-10">Create a project first.</p></Card>
      ) : !plan ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-tertiary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-sm font-medium text-secondary">No floor plan uploaded yet</p>
          <p className="text-xs text-tertiary max-w-xs text-center">Upload a photo or scan of the floor plan (PNG/JPG). Tasks get pinned directly on it.</p>
          <Button onClick={() => fileRef.current?.click()} loading={uploading}>+ Upload Plan</Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-secondary">Click anywhere on the plan to pin a new task. Click a pin to update it.</p>
            <Button variant="secondary" size="sm" onClick={replacePlan} loading={uploading}>Replace Plan</Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
          </div>

          <Card padding="none" className="overflow-hidden">
            <div
              ref={imgWrapRef}
              onClick={handleImageClick}
              className="relative w-full cursor-crosshair select-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={plan.label} className="w-full h-auto block pointer-events-none" draggable={false} />
              {pins.map(p => (
                <button
                  key={p.id}
                  onClick={e => { e.stopPropagation(); setSelectedPin(p) }}
                  title={p.title}
                  className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white shadow-lg ${STATUS_DOT[p.status] ?? 'bg-secondary'} hover:scale-125 transition-transform`}
                  style={{ left: `${p.pin_x * 100}%`, top: `${p.pin_y * 100}%` }}
                />
              ))}
            </div>
          </Card>

          <div className="flex items-center gap-4 text-xs text-secondary">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.5)]" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> In progress</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" /> Blocked</span>
          </div>
        </div>
      )}

      {/* New pin modal */}
      {pendingCoords && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPendingCoords(null)}
        >
          <div
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold text-primary mb-5">New Task at This Spot</h2>
              <form onSubmit={saveNewPin} className="space-y-4">
                <Input
                  label="Title"
                  required
                  autoFocus
                  placeholder="e.g. Repair drywall"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
                <Select
                  label="Priority"
                  options={priorityOptions}
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                />
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2.5 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none resize-none transition-colors"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setPendingCoords(null)} className="flex-1">Cancel</Button>
                  <Button type="submit" loading={saving} className="flex-1">Pin Task</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Existing pin popover */}
      {selectedPin && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedPin(null)}
        >
          <div
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[selectedPin.status] ?? 'bg-secondary'}`} />
              <h2 className="text-base font-semibold text-primary">{selectedPin.title}</h2>
            </div>
            {selectedPin.description && <p className="text-sm text-secondary mb-4">{selectedPin.description}</p>}
            <div className="flex gap-2 mb-4">
              <Badge variant="gray">{selectedPin.priority}</Badge>
              <Badge variant={selectedPin.status === 'completed' ? 'green' : selectedPin.status === 'in_progress' ? 'amber' : 'gray'}>
                {selectedPin.status}
              </Badge>
            </div>
            <div className="flex gap-3">
              {selectedPin.status !== 'in_progress' && selectedPin.status !== 'completed' && (
                <Button variant="secondary" className="flex-1" onClick={() => quickStatus(selectedPin.id, 'in_progress')}>Start</Button>
              )}
              {selectedPin.status !== 'completed' && (
                <Button className="flex-1" onClick={() => quickStatus(selectedPin.id, 'completed')}>Mark Complete</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
