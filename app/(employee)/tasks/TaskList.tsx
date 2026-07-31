'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/lib/company-context'
import { queueIfOffline } from '@/lib/offline-queue'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/lib/i18n/LocaleContext'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

function taskPhotoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/task-photos/${path}`
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1200
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.85)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

interface ChecklistItem { text: string; done: boolean }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = Record<string, any> & { id: string; title: string; status: string }

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-danger',
  high: 'bg-danger/60',
  medium: 'bg-amber',
  low: 'bg-blue',
}

const ACCENT_PALETTE = [
  { textCls: 'text-blue',   headerBgCls: 'bg-blue/10',   borderColor: 'rgb(var(--color-blue))' },
  { textCls: 'text-green',  headerBgCls: 'bg-green/10',  borderColor: 'rgb(var(--color-green))' },
  { textCls: 'text-amber',  headerBgCls: 'bg-amber/10',  borderColor: 'rgb(var(--color-amber))' },
  { textCls: 'text-brand',  headerBgCls: 'bg-brand/10',  borderColor: 'rgb(var(--color-brand))' },
  { textCls: 'text-danger', headerBgCls: 'bg-danger/10', borderColor: 'rgb(var(--color-danger))' },
]

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  )
}

export function TaskList({
  tasks: initial,
  profileId,
  employeeName,
  supabaseReady,
}: {
  tasks: Task[]
  profileId: string | null
  employeeName: string
  supabaseReady: boolean
}) {
  const companyId = useCompanyId()
  const { t } = useTranslation()
  const [tasks, setTasks] = useState(initial)
  const [selected, setSelected] = useState<Task | null>(null)
  const [liveStatus, setLiveStatus] = useState<string>('pending')
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const router = useRouter()

  // Before/after photo state
  const [beforePath, setBeforePath] = useState<string | null>(null)
  const [afterPath, setAfterPath] = useState<string | null>(null)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState<'before' | 'after' | null>(null)
  const beforeRef = useRef<HTMLInputElement>(null)
  const afterRef = useRef<HTMLInputElement>(null)

  function openTask(task: Task) {
    setSelected({ ...task })
    setLiveStatus(task.status)
    setNotes(task.notes ?? '')
    setBeforePath(null)
    setAfterPath(null)
  }

  // Load existing before/after photos for the selected task
  useEffect(() => {
    if (!selected?.id || !supabaseReady) return
    setLoadingPhotos(true)
    const supabase = createClient()
    supabase
      .from('task_media')
      .select('storage_path, photo_category')
      .eq('task_id', selected.id)
      .in('photo_category', ['before', 'after'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setLoadingPhotos(false); return }
        const before = data.find(r => r.photo_category === 'before')
        const after = data.find(r => r.photo_category === 'after')
        if (before && !beforePath) setBeforePath(before.storage_path)
        if (after && !afterPath) setAfterPath(after.storage_path)
        setLoadingPhotos(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  const handlePhoto = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: 'before' | 'after',
  ) => {
    const file = e.target.files?.[0]
    if (!file || !selected || !supabaseReady) return
    e.target.value = ''
    setUploadingPhoto(category)
    try {
      const blob = await compressImage(file)
      const path = `${selected.id}/${category}-${Date.now()}.jpg`
      const supabase = createClient()
      const { data: uploaded, error } = await supabase.storage
        .from('task-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error

      await supabase.from('task_media').insert({
        task_id: selected.id,
        project_id: selected.project_id ?? null,
        company_id: companyId,
        employee_id: profileId,
        media_type: 'photo',
        storage_path: uploaded.path,
        photo_category: category,
        uploaded_by_name: employeeName,
      })

      if (category === 'before') {
        setBeforePath(uploaded.path)
        // Auto-start task when before photo is uploaded
        if (liveStatus === 'pending') {
          await supabase.from('tasks').update({
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          }).eq('id', selected.id)
          setLiveStatus('in_progress')
          setTasks(prev => prev.map(tk => tk.id === selected.id ? { ...tk, status: 'in_progress' } : tk))
        }
      } else {
        setAfterPath(uploaded.path)
      }
    } catch {
      alert(t('employee.tasks.photoUploadFailed'))
    }
    setUploadingPhoto(null)
  }, [selected, supabaseReady, companyId, profileId, employeeName, liveStatus, t])

  async function toggleCheck(taskId: string, index: number, done: boolean) {
    const task = tasks.find(tk => tk.id === taskId)
    if (!task) return
    const checklist: ChecklistItem[] = (task.checklist ?? [])
    const newChecklist = checklist.map((item: ChecklistItem, i: number) =>
      i === index ? { ...item, done } : item
    )
    setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, checklist: newChecklist } : tk))
    if (selected?.id === taskId) setSelected(s => s ? { ...s, checklist: newChecklist } : s)

    if (supabaseReady) {
      const payload = { checklist: newChecklist, updated_at: new Date().toISOString() }
      try {
        const supabase = createClient()
        const { error } = await supabase.from('tasks').update(payload).eq('id', taskId)
        if (error) throw error
      } catch (err) {
        await queueIfOffline({ table: 'tasks', type: 'update', match: { id: taskId }, payload }, err)
      }
    }
  }

  async function completeTask(taskId: string) {
    if (!afterPath) {
      alert(t('employee.tasks.afterPhotoRequired'))
      return
    }
    if (!confirm(t('employee.tasks.confirmComplete'))) return
    setSaving(true)
    if (supabaseReady) {
      const update: Record<string, unknown> = {
        status: 'completed',
        updated_at: new Date().toISOString(),
      }
      if (notes) update.notes = notes
      try {
        const supabase = createClient()
        const { error } = await supabase.from('tasks').update(update).eq('id', taskId)
        if (error) throw error
      } catch (err) {
        await queueIfOffline({ table: 'tasks', type: 'update', match: { id: taskId }, payload: update }, err)
      }
    }
    setTasks(prev => prev.filter(tk => tk.id !== taskId))
    setSelected(null)
    setSaving(false)
    router.refresh()
  }

  async function saveNotes(taskId: string) {
    if (!supabaseReady) return
    const payload = { notes, updated_at: new Date().toISOString() }
    try {
      const supabase = createClient()
      const { error } = await supabase.from('tasks').update(payload).eq('id', taskId)
      if (error) throw error
      setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, notes } : tk))
    } catch (err) {
      setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, notes } : tk))
      await queueIfOffline({ table: 'tasks', type: 'update', match: { id: taskId }, payload }, err)
    }
  }

  const projectGroups = useMemo(() => {
    const map = new Map<string, { name: string; tasks: Task[] }>()
    for (const task of tasks) {
      const key = task.project_id ?? '__none__'
      const name = task.project?.name ?? 'Tasks'
      if (!map.has(key)) map.set(key, { name, tasks: [] })
      map.get(key)!.tasks.push(task)
    }
    return Array.from(map.values())
  }, [tasks])

  const taskStarted = liveStatus === 'in_progress' || liveStatus === 'completed'

  if (!supabaseReady) {
    return (
      <Card>
        <p className="text-sm text-secondary text-center py-6">{t('employee.tasks.connectSupabase')}</p>
      </Card>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-medium text-primary">{t('employee.tasks.allDone')}</p>
          <p className="text-xs text-secondary mt-1">{t('employee.tasks.noOpenTasksRightNow')}</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-5">
        {projectGroups.map((group, gi) => {
          const accent = ACCENT_PALETTE[gi % ACCENT_PALETTE.length]
          return (
            <div
              key={`proj-${gi}`}
              className="border border-[var(--border)] rounded-card bg-surface overflow-hidden"
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: accent.borderColor,
                boxShadow: '0 2px 8px rgba(0,0,0,0.09), 0 0 0 0 transparent',
              }}
            >
              {/* Project header */}
              <div className={`px-5 pt-4 pb-3.5 border-b border-[var(--border)] ${accent.headerBgCls}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-button flex-shrink-0 flex items-center justify-center text-sm font-bold text-white select-none"
                      style={{ backgroundColor: accent.borderColor }}
                    >
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-xl font-bold text-primary leading-tight truncate">
                      {group.name}
                    </h2>
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold text-secondary bg-surface px-2.5 py-1 rounded-full border border-[var(--border)]">
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
              </div>

              {/* Task rows */}
              <div className="divide-y divide-[var(--border)]">
                {group.tasks.map((task: Task) => {
                  const checklist: ChecklistItem[] = task.checklist ?? []
                  const doneCount = checklist.filter((c: ChecklistItem) => c.done).length
                  const totalCount = checklist.length
                  const priority: string = task.priority ?? 'medium'
                  const isInProgress = task.status === 'in_progress'
                  return (
                    <button
                      key={task.id}
                      onClick={() => openTask(task)}
                      className="w-full text-left px-5 py-4 hover:bg-surface-elevated transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[priority] ?? 'bg-secondary'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary">{task.title}</p>
                          {task.area && (
                            <p className="text-xs text-tertiary truncate mt-0.5">{task.area}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {isInProgress && (
                              <span className="text-[11px] font-medium text-blue bg-blue/10 px-2 py-0.5 rounded-full">
                                {t('common.inProgress')}
                              </span>
                            )}
                            {priority === 'urgent' && <Badge variant="gray">{t('common.priority.urgent')}</Badge>}
                            {priority === 'high' && <Badge variant="gray">{t('common.priority.high')}</Badge>}
                            {totalCount > 0 && (
                              <span className="text-[11px] text-secondary">
                                {t('employee.tasks.stepsProgress').replace('{done}', String(doneCount)).replace('{total}', String(totalCount))}
                              </span>
                            )}
                            {task.due_date && (
                              <span className={`text-[11px] ${new Date(task.due_date) < new Date() ? 'text-danger' : 'text-tertiary'}`}>
                                {t('employee.tasks.dueDatePrefix')} {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-tertiary flex-shrink-0 mt-1">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task detail bottom sheet */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-surface rounded-t-card border-t border-l border-r border-[var(--border)] w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-tertiary/40" />
            </div>

            <div className="px-5 py-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[selected.priority ?? 'medium'] ?? 'bg-secondary'}`} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-primary">{selected.title}</h2>
                  {selected.project?.name && <p className="text-xs text-secondary mt-0.5">{selected.project.name}</p>}
                  {selected.area && <p className="text-xs text-tertiary">{selected.area}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="p-1 text-tertiary hover:text-primary">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {selected.description && (
                <p className="text-sm text-secondary mb-4 leading-relaxed">{selected.description}</p>
              )}

              {/* ── Before Photo — required to start ── */}
              {supabaseReady && (
                <div className="mb-5">
                  {/* Before */}
                  <div className={[
                    'rounded-card border p-3 mb-3',
                    !beforePath ? 'border-amber/40 bg-amber/5' : 'border-green/30 bg-green/5',
                  ].join(' ')}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={['text-xs font-semibold uppercase tracking-wide', !beforePath ? 'text-amber' : 'text-green'].join(' ')}>
                        {t('employee.tasks.beforeLabel')}
                      </span>
                      {!beforePath && (
                        <span className="text-[10px] font-bold text-white bg-amber px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          {t('employee.tasks.requiredToStart')}
                        </span>
                      )}
                      {beforePath && (
                        <span className="text-[10px] font-bold text-white bg-green px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          ✓ {t('employee.tasks.done')}
                        </span>
                      )}
                    </div>

                    {loadingPhotos ? (
                      <div className="h-24 rounded-button bg-surface-elevated animate-pulse" />
                    ) : beforePath ? (
                      <div className="relative aspect-video rounded-button overflow-hidden bg-surface-elevated">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={taskPhotoUrl(beforePath)} alt="Before" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setBeforePath(null)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => beforeRef.current?.click()}
                        disabled={uploadingPhoto !== null}
                        className="w-full h-24 rounded-button bg-surface-elevated border-2 border-dashed border-amber/40 flex flex-col items-center justify-center gap-2 hover:bg-amber/5 transition-colors disabled:opacity-50"
                      >
                        {uploadingPhoto === 'before' ? (
                          <svg className="animate-spin w-5 h-5 text-amber" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                          </svg>
                        ) : (
                          <>
                            <CameraIcon className="w-6 h-6 text-amber" />
                            <span className="text-xs font-medium text-amber">{t('employee.tasks.takeBeforePhoto')}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* After */}
                  <div className={[
                    'rounded-card border p-3',
                    !taskStarted ? 'opacity-40 pointer-events-none' : '',
                    !afterPath ? 'border-[var(--border)] bg-surface-elevated/50' : 'border-green/30 bg-green/5',
                  ].join(' ')}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={['text-xs font-semibold uppercase tracking-wide', afterPath ? 'text-green' : 'text-secondary'].join(' ')}>
                        {t('employee.tasks.afterLabel')}
                      </span>
                      {taskStarted && !afterPath && (
                        <span className="text-[10px] font-bold text-white bg-brand px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          {t('employee.tasks.requiredToFinish')}
                        </span>
                      )}
                      {afterPath && (
                        <span className="text-[10px] font-bold text-white bg-green px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          ✓ {t('employee.tasks.done')}
                        </span>
                      )}
                    </div>

                    {afterPath ? (
                      <div className="relative aspect-video rounded-button overflow-hidden bg-surface-elevated">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={taskPhotoUrl(afterPath)} alt="After" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setAfterPath(null)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => afterRef.current?.click()}
                        disabled={uploadingPhoto !== null || !taskStarted}
                        className="w-full h-24 rounded-button bg-surface-elevated border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2 hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                      >
                        {uploadingPhoto === 'after' ? (
                          <svg className="animate-spin w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                          </svg>
                        ) : (
                          <>
                            <CameraIcon className="w-6 h-6 text-tertiary" />
                            <span className="text-xs text-tertiary">{t('employee.tasks.addAfter')}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Hidden file inputs with camera capture for mobile */}
                  <input ref={beforeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhoto(e, 'before')} />
                  <input ref={afterRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhoto(e, 'after')} />
                </div>
              )}

              {/* Checklist — locked until started */}
              {selected.checklist && selected.checklist.length > 0 && (
                <div className={['mb-5', !taskStarted ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">{t('employee.tasks.checklistLabel')}</p>
                  <div className="space-y-2">
                    {(selected.checklist as ChecklistItem[]).map((item, i) => (
                      <label key={i} className="flex items-center gap-3 cursor-pointer group">
                        <div
                          className={[
                            'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
                            item.done
                              ? 'bg-green border-green'
                              : 'border-[var(--border-strong)] group-hover:border-green/50',
                          ].join(' ')}
                          onClick={() => toggleCheck(selected.id, i, !item.done)}
                        >
                          {item.done && (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${item.done ? 'text-tertiary line-through' : 'text-primary'}`}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes — locked until started */}
              <div className={['mb-5', !taskStarted ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">{t('employee.tasks.notesLabel')}</p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={() => taskStarted && saveNotes(selected.id)}
                  placeholder={t('employee.tasks.notesPlaceholder')}
                  disabled={!taskStarted}
                  className="w-full bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2.5 border border-[var(--border)] focus:border-brand/50 outline-none resize-none transition-colors disabled:opacity-50"
                />
              </div>

              {/* CTA */}
              {!taskStarted ? (
                <div className="w-full flex items-center justify-center gap-2 h-12 rounded-button bg-amber/10 border border-amber/30 text-amber font-medium text-sm">
                  <CameraIcon className="w-5 h-5" />
                  {t('employee.tasks.takeBeforeToStart')}
                </div>
              ) : (
                <button
                  onClick={() => completeTask(selected.id)}
                  disabled={saving || !afterPath}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-button bg-green text-white font-semibold text-base hover:bg-green/90 transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {!afterPath ? t('employee.tasks.afterPhotoRequiredBtn') : t('employee.tasks.markComplete')}
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="safe-bottom" />
          </div>
        </div>
      )}
    </>
  )
}
