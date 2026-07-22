'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PlanViewer } from '@/components/admin/PlanViewer'
import type { PlanMarker } from '@/components/admin/PlanViewer'
import { useCompanyId } from '@/lib/company-context'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const supabaseReady =
  SUPABASE_URL && !SUPABASE_URL.startsWith('your_')

function planUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/plans/${path}`
}

function photoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/project-photos/${path}`
}

interface Project {
  id: string
  name: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  address: string | null
  description: string | null
  progress: number
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
  project_type?: string | null
  budget?: number | null
  hotel_name?: string | null
  leader_id?: string | null
}

interface PlanSheet {
  id: string
  plan_id: string
  storage_path: string
  file_type: string
  page_number: number
}

interface ProjectPlan {
  id: string
  name: string
  created_at: string
  sheets: PlanSheet[]
  markers: PlanMarker[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = Record<string, any> & { id: string; title: string; status: string }

interface Photo {
  id: string
  storage_path: string
  tag: string
  caption: string | null
  created_at: string
}

type Tab = 'overview' | 'plans' | 'tasks' | 'photos'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function statusBadge(s: string) {
  const map: Record<string, { label: string; variant: 'green' | 'amber' | 'blue' | 'gray' }> = {
    active:    { label: 'Active',    variant: 'green' },
    on_hold:   { label: 'On Hold',   variant: 'amber' },
    completed: { label: 'Completed', variant: 'blue' },
    cancelled: { label: 'Cancelled', variant: 'gray' },
  }
  const c = map[s] ?? { label: s, variant: 'gray' as const }
  return <Badge variant={c.variant}>{c.label}</Badge>
}

const PRIORITY_OPTS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const MARKER_TYPE_OPTS = [
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
]

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const router = useRouter()
  const companyId = useCompanyId()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Overview edit
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Plans
  const [plans, setPlans] = useState<ProjectPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [plansFetched, setPlansFetched] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<ProjectPlan | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [addMarkerMode, setAddMarkerMode] = useState(false)
  const [pendingMarker, setPendingMarker] = useState<{ x: number; y: number } | null>(null)
  const [markerForm, setMarkerForm] = useState({ type: 'task', title: '', description: '', priority: 'medium' })
  const [savingMarker, setSavingMarker] = useState(false)
  const [uploadingPlan, setUploadingPlan] = useState(false)
  const planFileRef = useRef<HTMLInputElement>(null)

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [tasksFetched, setTasksFetched] = useState(false)

  // Photos
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [photosFetched, setPhotosFetched] = useState(false)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoFileRef = useRef<HTMLInputElement>(null)

  // Load project
  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    const supabase = createClient()
    supabase.from('projects').select('*').eq('id', projectId).single().then(({ data }) => {
      if (data) {
        setProject(data as Project)
        setEditForm({
          name: data.name ?? '',
          address: data.address ?? '',
          client_name: data.client_name ?? '',
          client_email: data.client_email ?? '',
          client_phone: data.client_phone ?? '',
          description: data.description ?? '',
          status: data.status ?? 'active',
          progress: String(data.progress ?? 0),
          start_date: data.start_date ?? '',
          end_date: data.end_date ?? '',
        })
      } else {
        router.push('/admin/projects')
      }
      setLoading(false)
    })
  }, [projectId, router])

  const fetchPlans = useCallback(async () => {
    if (!supabaseReady || loadingPlans || plansFetched) return
    setLoadingPlans(true)
    const supabase = createClient()
    try {
      const { data: planRows } = await supabase
        .from('project_plans')
        .select('id, name, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (!planRows) { setLoadingPlans(false); setPlansFetched(true); return }

      const withSheets = await Promise.all(planRows.map(async (plan) => {
        const { data: sheets } = await supabase
          .from('plan_sheets')
          .select('*')
          .eq('plan_id', plan.id)
          .order('page_number')
        const sheetRows = (sheets ?? []) as PlanSheet[]
        const allMarkers: PlanMarker[] = []
        for (const sheet of sheetRows) {
          const { data: sm } = await supabase
            .from('plan_markers')
            .select('*')
            .eq('sheet_id', sheet.id)
            .order('created_at')
          allMarkers.push(...((sm ?? []) as PlanMarker[]))
        }
        return { ...plan, sheets: sheetRows, markers: allMarkers } as ProjectPlan
      }))

      setPlans(withSheets)
    } catch {
      // tables may not exist yet — silent
    }
    setPlansFetched(true)
    setLoadingPlans(false)
  }, [projectId, loadingPlans, plansFetched])

  const fetchTasks = useCallback(async () => {
    if (!supabaseReady || loadingTasks || tasksFetched) return
    setLoadingTasks(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('tasks')
      .select('*, assigned_employee:assigned_to(full_name)')
      .eq('project_id', projectId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
    setTasks((data ?? []) as Task[])
    setTasksFetched(true)
    setLoadingTasks(false)
  }, [projectId, loadingTasks, tasksFetched])

  const fetchPhotos = useCallback(async () => {
    if (!supabaseReady || loadingPhotos || photosFetched) return
    setLoadingPhotos(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('project_photos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setPhotos((data ?? []) as Photo[])
    setPhotosFetched(true)
    setLoadingPhotos(false)
  }, [projectId, loadingPhotos, photosFetched])

  useEffect(() => {
    if (activeTab === 'plans') fetchPlans()
    if (activeTab === 'tasks') fetchTasks()
    if (activeTab === 'photos') fetchPhotos()
  }, [activeTab, fetchPlans, fetchTasks, fetchPhotos])

  async function saveProject(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: editForm.name,
      address: editForm.address || null,
      client_name: editForm.client_name || null,
      client_email: editForm.client_email || null,
      client_phone: editForm.client_phone || null,
      description: editForm.description || null,
      status: editForm.status,
      progress: Number(editForm.progress) || 0,
      start_date: editForm.start_date || null,
      end_date: editForm.end_date || null,
    }
    const { data } = await supabase.from('projects').update(payload).eq('id', project.id).select().single()
    if (data) setProject(data as Project)
    setSaving(false)
    setEditing(false)
  }

  async function uploadPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !supabaseReady) return
    e.target.value = ''

    setUploadingPlan(true)
    const supabase = createClient()

    // 1. Create plan record
    const { data: plan, error: planErr } = await supabase
      .from('project_plans')
      .insert({ project_id: projectId, company_id: companyId, name: file.name.replace(/\.[^.]+$/, '') })
      .select()
      .single()

    if (planErr || !plan) { setUploadingPlan(false); alert('Failed to create plan record.'); return }

    // 2. Upload file
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `${projectId}/${plan.id}/sheet-1.${ext}`
    const { error: uploadErr } = await supabase.storage.from('plans').upload(storagePath, file, { contentType: file.type, upsert: true })

    if (uploadErr) {
      await supabase.from('project_plans').delete().eq('id', plan.id)
      setUploadingPlan(false)
      alert('Upload failed. Make sure the "plans" storage bucket is created and set to public in Supabase Dashboard.')
      return
    }

    // 3. Create sheet record
    const fileType = ext === 'pdf' ? 'pdf' : 'image'
    const { data: sheet } = await supabase
      .from('plan_sheets')
      .insert({ plan_id: plan.id, project_id: projectId, company_id: companyId, storage_path: storagePath, file_type: fileType, page_number: 1 })
      .select()
      .single()

    const newPlan: ProjectPlan = { ...plan, sheets: sheet ? [sheet as PlanSheet] : [], markers: [] }
    setPlans(prev => [newPlan, ...prev])
    setSelectedPlan(newPlan)
    setSheetIndex(0)
    setUploadingPlan(false)
  }

  async function saveMarker() {
    if (!pendingMarker || !selectedPlan) return
    const currentSheet = selectedPlan.sheets[sheetIndex]
    if (!currentSheet) return

    setSavingMarker(true)
    const supabase = createClient()

    let taskId: string | null = null

    if (markerForm.type === 'task') {
      try {
        const payload: Record<string, unknown> = {
          project_id: projectId,
          company_id: companyId,
          title: markerForm.title,
          description: markerForm.description || null,
          status: 'pending',
          plan_sheet_id: currentSheet.id,
          plan_x_pct: pendingMarker.x,
          plan_y_pct: pendingMarker.y,
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload as any).priority = markerForm.priority
        } catch { /* column may not exist */ }

        const { data: task } = await supabase.from('tasks').insert(payload).select().single()
        taskId = task?.id ?? null
      } catch { /* silent */ }
    }

    try {
      const { data: marker } = await supabase
        .from('plan_markers')
        .insert({
          sheet_id: currentSheet.id,
          project_id: projectId,
          company_id: companyId,
          marker_type: markerForm.type,
          title: markerForm.title,
          description: markerForm.description || null,
          x_pct: pendingMarker.x,
          y_pct: pendingMarker.y,
          task_id: taskId,
        })
        .select()
        .single()

      if (marker) {
        const newMarker = marker as PlanMarker
        setSelectedPlan(prev => {
          if (!prev) return prev
          return { ...prev, markers: [...prev.markers, newMarker] }
        })
        setPlans(prev => prev.map(p =>
          p.id === selectedPlan.id ? { ...p, markers: [...p.markers, newMarker] } : p
        ))
      }
    } catch {
      alert('Failed to save marker. Run migration 004 first.')
    }

    setPendingMarker(null)
    setMarkerForm({ type: 'task', title: '', description: '', priority: 'medium' })
    setSavingMarker(false)
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !supabaseReady) return
    e.target.value = ''
    setUploadingPhoto(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${projectId}/misc-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('project-photos').upload(path, file, { contentType: file.type, upsert: true })
    if (error) { alert('Upload failed. Check if "project-photos" bucket exists.'); setUploadingPhoto(false); return }
    const { data: row } = await supabase
      .from('project_photos')
      .insert({ project_id: projectId, company_id: companyId, storage_path: path, tag: 'progress' })
      .select().single()
    if (row) setPhotos(prev => [row as Photo, ...prev])
    setUploadingPhoto(false)
  }

  const currentSheet = selectedPlan?.sheets[sheetIndex]
  const currentSheetMarkers = selectedPlan
    ? selectedPlan.markers.filter(m => currentSheet && (m as unknown as Record<string, string>).sheet_id === currentSheet.id)
    : []

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-secondary text-sm">Loading project…</p>
      </div>
    )
  }

  if (!project && supabaseReady) {
    return (
      <div className="p-4 md:p-8 text-center">
        <p className="text-secondary">Project not found.</p>
        <Button onClick={() => router.push('/admin/projects')} variant="secondary" className="mt-4">
          ← Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1000px]">
      {/* Header */}
      <div className="mb-5 md:mb-6">
        <button
          onClick={() => router.push('/admin/projects')}
          className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors mb-3"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Projects
        </button>

        {project ? (
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">{project.name}</h1>
                {statusBadge(project.status)}
              </div>
              {project.address && <p className="text-sm text-secondary mt-0.5">{project.address}</p>}
            </div>
            <Button onClick={() => setEditing(true)} variant="secondary" className="flex-shrink-0">
              Edit
            </Button>
          </div>
        ) : (
          <div className="bg-amber/5 border border-amber/20 rounded-card p-4">
            <p className="text-sm text-amber">Connect Supabase to see project details.</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-6 overflow-x-auto">
        {(['overview', 'plans', 'tasks', 'photos'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-3 text-sm font-medium capitalize flex-shrink-0 transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-brand text-primary'
                : 'border-transparent text-secondary hover:text-primary',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && project && (
        <div className="space-y-4">
          {/* Progress */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-secondary">Progress</p>
              <p className="text-lg font-bold text-primary">{project.progress}%</p>
            </div>
            <ProgressBar value={project.progress} />
          </Card>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Project Info</p>
              <div className="space-y-2">
                {project.address && (
                  <div>
                    <p className="text-xs text-tertiary">Address</p>
                    <p className="text-sm text-primary">{project.address}</p>
                  </div>
                )}
                {project.start_date && (
                  <div>
                    <p className="text-xs text-tertiary">Start Date</p>
                    <p className="text-sm text-primary">{new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                )}
                {project.end_date && (
                  <div>
                    <p className="text-xs text-tertiary">End Date</p>
                    <p className="text-sm text-primary">{new Date(project.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-tertiary">Created</p>
                  <p className="text-sm text-primary">{new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Client</p>
              <div className="space-y-2">
                {project.client_name ? (
                  <>
                    <div>
                      <p className="text-xs text-tertiary">Name</p>
                      <p className="text-sm text-primary">{project.client_name}</p>
                    </div>
                    {project.client_email && (
                      <div>
                        <p className="text-xs text-tertiary">Email</p>
                        <p className="text-sm text-primary">{project.client_email}</p>
                      </div>
                    )}
                    {project.client_phone && (
                      <div>
                        <p className="text-xs text-tertiary">Phone</p>
                        <p className="text-sm text-primary">{project.client_phone}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-tertiary">No client assigned.</p>
                )}
              </div>
            </Card>
          </div>

          {project.description && (
            <Card>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-secondary leading-relaxed">{project.description}</p>
            </Card>
          )}
        </div>
      )}

      {/* ── PLANS ── */}
      {activeTab === 'plans' && (
        <div>
          {/* Plan viewer */}
          {selectedPlan && currentSheet && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelectedPlan(null); setAddMarkerMode(false) }}
                    className="text-secondary hover:text-primary transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h2 className="text-sm font-semibold text-primary">{selectedPlan.name}</h2>
                  <span className="text-xs text-tertiary">{selectedPlan.markers.length} marker{selectedPlan.markers.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => setAddMarkerMode(m => !m)}
                  className={[
                    'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-button transition-colors',
                    addMarkerMode
                      ? 'bg-brand text-white'
                      : 'bg-surface-elevated text-secondary hover:text-primary border border-[rgba(255,255,255,0.07)]',
                  ].join(' ')}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  {addMarkerMode ? 'Cancel' : 'Add Marker'}
                </button>
              </div>

              {/* Sheet tabs */}
              {selectedPlan.sheets.length > 1 && (
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {selectedPlan.sheets.map((sheet, i) => (
                    <button
                      key={sheet.id}
                      onClick={() => setSheetIndex(i)}
                      className={[
                        'text-xs px-3 py-1.5 rounded-button flex-shrink-0 transition-colors',
                        sheetIndex === i
                          ? 'bg-brand text-white'
                          : 'bg-surface-elevated text-secondary hover:text-primary border border-[rgba(255,255,255,0.07)]',
                      ].join(' ')}
                    >
                      Sheet {sheet.page_number}
                    </button>
                  ))}
                </div>
              )}

              {currentSheet.file_type === 'pdf' ? (
                <div className="rounded-card overflow-hidden" style={{ height: 480 }}>
                  <iframe
                    src={planUrl(currentSheet.storage_path)}
                    className="w-full h-full"
                    title="PDF Plan"
                    style={{ border: 'none' }}
                  />
                  <p className="text-xs text-tertiary mt-2">PDF plans display in viewer only — markers require image format (PNG/JPG).</p>
                </div>
              ) : (
                <PlanViewer
                  imageUrl={planUrl(currentSheet.storage_path)}
                  markers={currentSheetMarkers}
                  addMarkerMode={addMarkerMode}
                  onAddMarker={(x, y) => {
                    setPendingMarker({ x, y })
                    setMarkerForm({ type: 'task', title: '', description: '', priority: 'medium' })
                  }}
                  onMarkerClick={m => alert(`${m.marker_type.toUpperCase()}: ${m.title}`)}
                />
              )}
            </div>
          )}

          {/* Plans list */}
          {!selectedPlan && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-primary">Floor Plans & Blueprints</h2>
                <div className="flex items-center gap-2">
                  {!supabaseReady && <span className="text-xs text-amber">Connect Supabase</span>}
                  <Button
                    onClick={() => planFileRef.current?.click()}
                    loading={uploadingPlan}
                    disabled={!supabaseReady || uploadingPlan}
                  >
                    {uploadingPlan ? 'Uploading…' : '+ Upload Plan'}
                  </Button>
                </div>
              </div>
              <input
                ref={planFileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                className="hidden"
                onChange={uploadPlan}
              />

              {loadingPlans && <p className="text-sm text-secondary text-center py-8">Loading plans…</p>}

              {!loadingPlans && plans.length === 0 && (
                <Card>
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-brand">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-primary">No plans yet</p>
                    <p className="text-xs text-secondary mt-1">Upload PNG, JPG, or PDF floor plans to get started.</p>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => { setSelectedPlan(plan); setSheetIndex(0); setAddMarkerMode(false) }}
                    className="text-left"
                  >
                    <Card className="hover:bg-surface-elevated transition-colors" padding="none">
                      {/* Thumbnail */}
                      <div className="aspect-[4/3] bg-[#0a0a0a] rounded-t-card overflow-hidden">
                        {plan.sheets[0] && plan.sheets[0].file_type !== 'pdf' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={planUrl(plan.sheets[0].storage_path)}
                            alt={plan.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-tertiary">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-primary truncate">{plan.name}</p>
                        <p className="text-xs text-secondary mt-0.5">
                          {plan.sheets.length} sheet{plan.sheets.length !== 1 ? 's' : ''} · {plan.markers.length} marker{plan.markers.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TASKS ── */}
      {activeTab === 'tasks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-primary">{tasks.length} Open Task{tasks.length !== 1 ? 's' : ''}</h2>
          </div>
          {loadingTasks && <p className="text-sm text-secondary text-center py-8">Loading tasks…</p>}
          {!loadingTasks && tasks.length === 0 && (
            <Card>
              <p className="text-sm text-secondary text-center py-8">No open tasks for this project.</p>
            </Card>
          )}
          <div className="space-y-2">
            {tasks.map(t => (
              <Card key={t.id}>
                <div className="flex items-start gap-3">
                  <div className={['w-2 h-2 rounded-full flex-shrink-0 mt-1.5', t.priority === 'urgent' ? 'bg-danger' : t.priority === 'high' ? 'bg-danger/60' : t.priority === 'medium' ? 'bg-amber' : 'bg-blue'].join(' ')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{t.title}</p>
                    {t.assigned_employee?.full_name && (
                      <p className="text-xs text-secondary mt-0.5">{t.assigned_employee.full_name}</p>
                    )}
                    {t.area && <p className="text-xs text-tertiary">{t.area}</p>}
                  </div>
                  {statusBadge(t.status)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── PHOTOS ── */}
      {activeTab === 'photos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-primary">Photos</h2>
            <Button
              onClick={() => photoFileRef.current?.click()}
              loading={uploadingPhoto}
              disabled={!supabaseReady || uploadingPhoto}
            >
              {uploadingPhoto ? 'Uploading…' : '+ Add Photo'}
            </Button>
          </div>
          <input
            ref={photoFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={uploadPhoto}
          />

          {loadingPhotos && <p className="text-sm text-secondary text-center py-8">Loading photos…</p>}
          {!loadingPhotos && photos.length === 0 && (
            <Card>
              <p className="text-sm text-secondary text-center py-8">No photos yet.</p>
            </Card>
          )}

          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map(p => (
              <button
                key={p.id}
                onClick={() => setLightbox(p)}
                className="aspect-square rounded-button overflow-hidden bg-surface-elevated"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(p.storage_path)}
                  alt="Project photo"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Project Modal ── */}
      {editing && project && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold text-primary mb-5">Edit Project</h2>
              <form onSubmit={saveProject} className="space-y-4">
                <Input
                  label="Project Name"
                  required
                  value={editForm.name ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
                <Input
                  label="Address"
                  placeholder="e.g. 123 Main St, Charleston SC"
                  value={editForm.address ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Client Name"
                    value={editForm.client_name ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))}
                  />
                  <Input
                    label="Client Email"
                    type="email"
                    value={editForm.client_email ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, client_email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Start Date"
                    type="date"
                    value={editForm.start_date ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={editForm.end_date ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={editForm.status ?? 'active'}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                />
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    Progress: {editForm.progress ?? 0}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editForm.progress ?? 0}
                    onChange={e => setEditForm(f => ({ ...f, progress: e.target.value }))}
                    className="w-full accent-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2.5 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" loading={saving} className="flex-1">Save Changes</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Marker Modal ── */}
      {pendingMarker && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPendingMarker(null)}
        >
          <div
            className="bg-surface rounded-card border border-[rgba(255,255,255,0.08)] w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5">
              <h2 className="text-base font-semibold text-primary mb-4">Add Marker</h2>
              <div className="space-y-3">
                <Select
                  label="Type"
                  options={MARKER_TYPE_OPTS}
                  value={markerForm.type}
                  onChange={e => setMarkerForm(f => ({ ...f, type: e.target.value }))}
                />
                <Input
                  label="Title"
                  required
                  placeholder={markerForm.type === 'task' ? 'e.g. Inspect foundation' : 'Note title'}
                  value={markerForm.title}
                  onChange={e => setMarkerForm(f => ({ ...f, title: e.target.value }))}
                />
                {markerForm.type === 'task' && (
                  <Select
                    label="Priority"
                    options={PRIORITY_OPTS}
                    value={markerForm.priority}
                    onChange={e => setMarkerForm(f => ({ ...f, priority: e.target.value }))}
                  />
                )}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={markerForm.description}
                    onChange={e => setMarkerForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional…"
                    className="w-full bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2.5 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button type="button" variant="secondary" onClick={() => setPendingMarker(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={saveMarker}
                  loading={savingMarker}
                  disabled={!markerForm.title.trim() || savingMarker}
                  className="flex-1"
                >
                  {markerForm.type === 'task' ? 'Create Task' : 'Save Note'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(lightbox.storage_path)}
            alt="Project photo"
            className="max-w-full max-h-full object-contain rounded-card"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface/80 border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-secondary hover:text-primary backdrop-blur-sm"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
