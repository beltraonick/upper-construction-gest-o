'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/lib/company-context'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const PHOTO_BUCKET = 'project-photos'

interface ChecklistItem { text: string; done: boolean }
interface TaskPhoto { id: string; storage_path: string; created_at: string }

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
  profileId,
  supabaseReady,
}: {
  tasks: Task[]
  profileId: string | null
  supabaseReady: boolean
}) {
  const companyId = useCompanyId()
  const [tasks, setTasks] = useState(initial)
  const [selected, setSelected] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function openTask(t: Task) {
    setSelected({ ...t })
    setNotes(t.notes ?? '')
    setPhotos([])
    if (supabaseReady) {
      const supabase = createClient()
      const { data } = await supabase
        .from('task_media')
        .select('id, storage_path, created_at')
        .eq('task_id', t.id)
        .eq('media_type', 'photo')
        .order('created_at', { ascending: false })
      setPhotos(data ?? [])
    }
  }

  function photoUrl(path: string) {
    const supabase = createClient()
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0 || !selected) return
    setUploading(true)
    const supabase = createClient()

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `tasks/${selected.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file)
      if (!uploadErr) {
        await supabase.from('task_media').insert({
          task_id: selected.id,
          project_id: selected.project_id ?? null,
          employee_id: profileId,
          company_id: companyId,
          media_type: 'photo',
          storage_path: path,
        })
      }
    }

    const { data } = await supabase
      .from('task_media')
      .select('id, storage_path, created_at')
      .eq('task_id', selected.id)
      .eq('media_type', 'photo')
      .order('created_at', { ascending: false })
    setPhotos(data ?? [])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

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

              {/* Photos */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Photos</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover transition-colors disabled:opacity-50"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    {uploading ? 'Uploading…' : 'Add Photo'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={e => handlePhotoUpload(e.target.files)}
                  />
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map(p => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.id}
                        src={photoUrl(p.storage_path)}
                        alt="Task photo"
                        className="aspect-square object-cover rounded-button bg-surface-elevated"
                      />
                    ))}
                  </div>
                )}
              </div>

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
