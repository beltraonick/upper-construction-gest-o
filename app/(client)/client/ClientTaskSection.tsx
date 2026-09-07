'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useTranslation } from '@/lib/i18n/LocaleContext'

interface Room {
  id: string
  project_id: string
  floor: string | null
  label: string
}

interface TaskPhoto {
  id: string
  storage_path: string
  created_at: string | null
  photo_category: string | null
}

interface ClientTask {
  id: string
  title: string
  status: string
  area: string | null
  due_date: string | null
  room_id: string | null
  checklist: { text: string; done: boolean }[]
  project_id: string | null
}

interface Props {
  projectName: string
  tasks: ClientTask[]
  rooms: Room[]
  photosByTask: Record<string, TaskPhoto[]>
  supabaseUrl: string
  locale: 'en' | 'pt' | 'es'
}

function fmtDate(iso: string, locale: string) {
  const dateLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US'
  return new Date(iso).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
}

function photoUrl(supabaseUrl: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/task-photos/${path}`
}

export function ClientTaskSection({ projectName, tasks, rooms, photosByTask, supabaseUrl, locale }: Props) {
  const { t } = useTranslation()
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  // Build floor list from rooms in this project
  const floors = Array.from(new Set(rooms.map(r => r.floor).filter(Boolean) as string[])).sort()

  // Map room id → floor
  const roomFloorMap: Record<string, string | null> = {}
  for (const room of rooms) {
    roomFloorMap[room.id] = room.floor
  }

  // Filter tasks by selected floor
  const filteredTasks = selectedFloor === 'all'
    ? tasks
    : tasks.filter(task => {
        if (!task.room_id) return false
        return roomFloorMap[task.room_id] === selectedFloor
      })

  if (tasks.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-primary mb-3">
        {projectName} — {t('client.overview.tasks')}
      </h2>

      {/* Floor filter pills */}
      {floors.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setSelectedFloor('all')}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              selectedFloor === 'all'
                ? 'bg-brand text-white'
                : 'bg-surface-elevated text-secondary border border-[var(--border)]',
            ].join(' ')}
          >
            {t('client.overview.allFloors')}
          </button>
          {floors.map(floor => (
            <button
              key={floor}
              onClick={() => setSelectedFloor(floor)}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                selectedFloor === floor
                  ? 'bg-brand text-white'
                  : 'bg-surface-elevated text-secondary border border-[var(--border)]',
              ].join(' ')}
            >
              {floor}
            </button>
          ))}
        </div>
      )}

      <Card padding="none">
        <div className="divide-y divide-[var(--border)]">
          {filteredTasks.map(task => {
            const isExpanded = expandedTaskId === task.id
            const photos = photosByTask[task.id] ?? []
            const doneItems = (task.checklist ?? []).filter((c: { done: boolean }) => c.done).length
            const totalItems = (task.checklist ?? []).length
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

            return (
              <div key={task.id}>
                {/* Task row — tappable */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-elevated transition-colors"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    task.status === 'completed' ? 'bg-green' :
                    task.status === 'in_progress' ? 'bg-amber' : 'bg-tertiary/40'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-tertiary line-through' : 'text-primary'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[11px] ${
                        task.status === 'completed' ? 'text-green' :
                        task.status === 'in_progress' ? 'text-amber' : 'text-secondary'
                      }`}>
                        {task.status === 'completed' ? t('client.overview.done') :
                         task.status === 'in_progress' ? t('client.overview.inProgress') :
                         t('client.overview.notStarted')}
                      </span>
                      {task.area && <span className="text-[11px] text-tertiary">{task.area}</span>}
                      {totalItems > 0 && (
                        <span className="text-[11px] text-tertiary">{doneItems}/{totalItems}</span>
                      )}
                      {task.due_date && (
                        <span className={`text-[11px] ${isOverdue ? 'text-danger font-medium' : 'text-tertiary'}`}>
                          {new Date(task.due_date + 'T00:00:00').toLocaleDateString(
                            locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
                            { month: 'short', day: 'numeric' }
                          )}
                        </span>
                      )}
                      {photos.length > 0 && (
                        <span className="text-[11px] text-brand font-medium">
                          {photos.length} {t('client.overview.taskPhotos').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Chevron */}
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`w-4 h-4 text-tertiary flex-shrink-0 mt-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Expanded: photos */}
                {isExpanded && (
                  <div className="bg-surface-elevated px-4 pb-4 pt-2 border-t border-[var(--border)]">
                    <p className="text-xs font-semibold text-secondary mb-2">{t('client.overview.taskPhotos')}</p>
                    {photos.length === 0 ? (
                      <p className="text-xs text-tertiary">{t('client.overview.noPhotos')}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map(photo => (
                          <div key={photo.id} className="space-y-1">
                            <div className="aspect-square rounded-[10px] overflow-hidden bg-surface">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrl(supabaseUrl, photo.storage_path)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {photo.created_at && (
                              <p className="text-[10px] text-tertiary text-center">
                                {t('client.overview.postedOn')} {fmtDate(photo.created_at, locale)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
