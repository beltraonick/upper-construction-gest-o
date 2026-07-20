'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
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

// Accepts any task shape — works with both pre- and post-migration schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = Record<string, any> & { id: string; title: string; status: string }

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-danger',
  high: 'bg-danger/60',
  medium: 'bg-amber',
  low: 'bg-blue',
}

export function TaskList({
  tasks: initial,
  profileId: _profileId,
  supabaseReady,
}: {
  tasks: Task[]
  profileId: string | null
  supabaseReady: boolean
}) {
  const [tasks, setTasks] = useState(initial)
  const [selected, setSelected] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const router = useRouter()

  // Before/after photo state
  const [beforePath, setBeforePath] = useState<string | null>(null)
  const [afterPath, setAfterPath] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const beforeRef = useRef<HTMLInputElement>(null)
  const afterRef = useRef<HTMLInputElement>(null)

  function openTask(t: Task) {
    setSelected({ ...t })
    setNotes(t.notes ?? '')
    setBeforePath(null)
    setAfterPath(null)
  }

  const handlePhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, category: 'before' | 'after') => {
    const file = e.target.files?.[0]
    if (!file || !selected || !supabaseReady) return
    e.target.value = ''
    setUploadingPhoto(true)
    try {
      const blob = await compressImage(file)
      const path = `${selected.id}/${category}-${Date.now()}.jpg`
      const supabase = createClient()
      const { data: uploaded, error } = await supabase.storage
        .from('task-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error

      // Insert task_media row; photo_category added in migration 004
      try {
        await supabase.from('task_media').insert({
          task_id: selected.id,
          project_id: selected.project_id ?? null,
          company_id: COMPANY_ID,
          media_type: 'photo',
          storage_path: uploaded.path,
          photo_category: category,
        })
      } catch {
        // Column may not exist yet; storage upload succeeded
      }

      if (category === 'before') setBeforePath(uploaded.path)
      else setAfterPath(uploaded.path)
    } catch {
      alert('Photo upload failed. Make sure the "task-photos" storage bucket is created and set to public in Supabase Dashboard.')
    }
    setUploadingPhoto(false)
  }, [selected, supabaseReady])

  async function toggleCheck(taskId: string, index: number, done: boolean) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const checklist: ChecklistItem[] = (task.checklist ?? [])
    const newChecklist = checklist.map((item: ChecklistItem, i: number) =>
      i === index ? { ...item, done } : item
    )
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, checklist: newChecklist } : t))
    if (selected?.id === taskId) setSelected(s => s ? { ...s, checklist: newChecklist } : s)

    if (supabaseReady) {
      try {
        const supabase = createClient()
        await supabase.from('tasks').update({ checklist: newChecklist, updated_at: new Date().toISOString() }).eq('id', taskId)
      } catch { /* column may not exist yet; optimistic update already applied */ }
    }
  }

  async function completeTask(taskId: string) {
    // Photo requirements check
    if (selected?.before_photo_required && !beforePath) {
      alert('Please upload a Before photo before completing this task.')
      return
    }
    if (selected?.after_photo_required && !afterPath) {
      alert('Please upload an After photo before completing this task.')
      return
    }
    if (!confirm('Mark this task as complete?')) return
    setSaving(true)
    if (supabaseReady) {
      try {
        const supabase = createClient()
        const update: Record<string, unknown> = {
          status: 'completed',
          updated_at: new Date().toISOString(),
        }
        // Include optional columns only when notes text was typed
        if (notes) update.notes = notes
        await supabase.from('tasks').update(update).eq('id', taskId)
      } catch { /* silent */ }
    }
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSelected(null)
    setSaving(false)
    router.refresh()
  }

  async function saveNotes(taskId: string) {
    if (!supabaseReady) return
    try {
      const supabase = createClient()
      await supabase.from('tasks').update({ notes, updated_at: new Date().toISOString() }).eq('id', taskId)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes } : t))
    } catch { /* column may not exist yet */ }
  }

  if (!supabaseReady) {
    return (
      <Card>
        <p className="text-sm text-secondary text-center py-6">Connect Supabase to view tasks.</p>
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
          <p className="text-sm font-medium text-primary">All done!</p>
          <p className="text-xs text-secondary mt-1">No open tasks right now.</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((t: Task) => {
          const checklist: ChecklistItem[] = t.checklist ?? []
          const doneCount = checklist.filter((c: ChecklistItem) => c.done).length
          const totalCount = checklist.length
          const priority: string = t.priority ?? 'medium'
          return (
            <button
              key={t.id}
              onClick={() => openTask(t)}
              className="w-full text-left"
            >
              <Card className="hover:bg-surface-elevated transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[priority] ?? 'bg-secondary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{t.title}</p>
                    {t.project?.name && (
                      <p className="text-xs text-secondary mt-0.5 truncate">{t.project.name}</p>
                    )}
                    {t.area && (
                      <p className="text-xs text-tertiary truncate">{t.area}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {priority === 'urgent' && <Badge variant="gray">Urgent</Badge>}
                      {priority === 'high' && <Badge variant="gray">High</Badge>}
                      {totalCount > 0 && (
                        <span className="text-[11px] text-secondary">{doneCount}/{totalCount} steps</span>
                      )}
                      {t.due_date && (
                        <span className={`text-[11px] ${new Date(t.due_date) < new Date() ? 'text-danger' : 'text-tertiary'}`}>
                          Due {new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-tertiary flex-shrink-0 mt-1">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </Card>
            </button>
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
            className="bg-surface rounded-t-card border-t border-l border-r border-[rgba(255,255,255,0.08)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
            </div>

            <div className="px-5 py-4">
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

              {/* Checklist — shown only after migration adds this column */}
              {selected.checklist && selected.checklist.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Checklist</p>
                  <div className="space-y-2">
                    {(selected.checklist as ChecklistItem[]).map((item, i) => (
                      <label key={i} className="flex items-center gap-3 cursor-pointer group">
                        <div
                          className={[
                            'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
                            item.done
                              ? 'bg-green border-green'
                              : 'border-[rgba(255,255,255,0.2)] group-hover:border-green/50',
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

              {/* Before / After Photos */}
              {supabaseReady && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Photos</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Before photo */}
                    <div>
                      <p className="text-[11px] text-secondary mb-1.5 flex items-center gap-1">
                        Before
                        {selected?.before_photo_required && (
                          <span className="text-danger font-semibold">*</span>
                        )}
                      </p>
                      {beforePath ? (
                        <div className="aspect-square rounded-button overflow-hidden bg-surface-elevated relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={taskPhotoUrl(beforePath)} alt="Before" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setBeforePath(null)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => beforeRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="w-full aspect-square rounded-button bg-surface-elevated border border-dashed border-[rgba(255,255,255,0.12)] flex flex-col items-center justify-center gap-1.5 hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-tertiary">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                          </svg>
                          <span className="text-[11px] text-tertiary">Add Before</span>
                        </button>
                      )}
                    </div>

                    {/* After photo */}
                    <div>
                      <p className="text-[11px] text-secondary mb-1.5 flex items-center gap-1">
                        After
                        {selected?.after_photo_required && (
                          <span className="text-danger font-semibold">*</span>
                        )}
                      </p>
                      {afterPath ? (
                        <div className="aspect-square rounded-button overflow-hidden bg-surface-elevated relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={taskPhotoUrl(afterPath)} alt="After" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setAfterPath(null)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => afterRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="w-full aspect-square rounded-button bg-surface-elevated border border-dashed border-[rgba(255,255,255,0.12)] flex flex-col items-center justify-center gap-1.5 hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-tertiary">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                          </svg>
                          <span className="text-[11px] text-tertiary">Add After</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {uploadingPhoto && (
                    <p className="text-[11px] text-secondary mt-2 text-center">Uploading photo…</p>
                  )}

                  {/* Hidden file inputs */}
                  <input
                    ref={beforeRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handlePhoto(e, 'before')}
                  />
                  <input
                    ref={afterRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handlePhoto(e, 'after')}
                  />
                </div>
              )}

              {/* Notes */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Notes</p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={() => saveNotes(selected.id)}
                  placeholder="Add notes…"
                  className="w-full bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2.5 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none resize-none transition-colors"
                />
              </div>

              <button
                onClick={() => completeTask(selected.id)}
                disabled={saving}
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
                    Mark as Complete
                  </>
                )}
              </button>
            </div>

            <div className="safe-bottom" />
          </div>
        </div>
      )}
    </>
  )
}
