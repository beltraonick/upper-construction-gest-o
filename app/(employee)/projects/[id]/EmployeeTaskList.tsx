'use client'

import { useState, useTransition } from 'react'
import { updateEmployeeTask } from '@/app/actions/employeeTasks'

type ChecklistItem = { text: string; done: boolean }

type Task = {
  id: string
  title: string
  status: string
  area: string | null
  due_date: string | null
  checklist: ChecklistItem[]
}

type Props = {
  initialTasks: Task[]
  locale: string
  projectId: string
}

const STATUS_OPTIONS = [
  { value: 'pending', labelPt: 'Pendente', labelEn: 'Pending', labelEs: 'Pendiente' },
  { value: 'in_progress', labelPt: 'Em andamento', labelEn: 'In progress', labelEs: 'En progreso' },
  { value: 'completed', labelPt: 'Concluído', labelEn: 'Completed', labelEs: 'Completado' },
]

function statusLabel(status: string, locale: string) {
  const opt = STATUS_OPTIONS.find(s => s.value === status)
  if (!opt) return status
  return locale === 'pt' ? opt.labelPt : locale === 'es' ? opt.labelEs : opt.labelEn
}

function fmtDate(iso: string, locale: string) {
  const dateLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US'
  return new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
}

export function EmployeeTaskList({ initialTasks, locale }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [editing, setEditing] = useState<Task | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function openEdit(task: Task) {
    setEditing(task)
    setEditStatus(task.status)
    setEditChecklist((task.checklist ?? []).map(c => ({ ...c })))
    setSaved(false)
  }

  function closeEdit() {
    setEditing(null)
  }

  function toggleCheckItem(index: number) {
    setEditChecklist(prev =>
      prev.map((item, i) => i === index ? { ...item, done: !item.done } : item)
    )
  }

  function handleSave() {
    if (!editing) return
    startTransition(async () => {
      const result = await updateEmployeeTask(editing.id, {
        status: editStatus,
        checklist: editChecklist,
      })
      if (result.ok) {
        setTasks(prev =>
          prev.map(t =>
            t.id === editing.id
              ? { ...t, status: editStatus, checklist: editChecklist }
              : t
          )
        )
        setSaved(true)
        setTimeout(() => closeEdit(), 800)
      }
    })
  }

  const saveLabel = locale === 'pt' ? 'Salvar' : locale === 'es' ? 'Guardar' : 'Save'
  const savingLabel = locale === 'pt' ? 'Salvando…' : locale === 'es' ? 'Guardando…' : 'Saving…'
  const savedLabel = locale === 'pt' ? 'Salvo ✓' : locale === 'es' ? 'Guardado ✓' : 'Saved ✓'
  const checklistTitle = locale === 'pt' ? 'Checklist' : locale === 'es' ? 'Lista de tareas' : 'Checklist'
  const statusTitle = locale === 'pt' ? 'Status' : 'Status'
  const dueLabel = locale === 'pt' ? 'Prazo' : locale === 'es' ? 'Vence' : 'Due'
  const tapHint = locale === 'pt' ? 'Toque para editar' : locale === 'es' ? 'Toca para editar' : 'Tap to edit'

  const doneTasks = tasks.filter(t => t.status === 'completed').length
  const pendingTasks = tasks.filter(t => t.status !== 'completed').length

  return (
    <>
      {/* Summary counts */}
      <div className="flex gap-4 text-xs text-secondary mb-5">
        <span>{pendingTasks} {locale === 'pt' ? 'pendente' + (pendingTasks !== 1 ? 's' : '') : locale === 'es' ? 'pendiente' + (pendingTasks !== 1 ? 's' : '') : 'pending'}</span>
        <span>{doneTasks} {locale === 'pt' ? 'concluída' + (doneTasks !== 1 ? 's' : '') : locale === 'es' ? 'completada' + (doneTasks !== 1 ? 's' : '') : 'completed'}</span>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-sm text-secondary text-center py-8">
          {locale === 'pt' ? 'Nenhuma tarefa atribuída a você neste projeto.' : locale === 'es' ? 'No tienes tareas asignadas en este proyecto.' : 'No tasks assigned to you in this project.'}
        </p>
      ) : (
        <div className="bg-surface rounded-[16px] border border-[var(--border)] divide-y divide-[var(--border)]">
          {tasks.map(task => {
            const doneItems = (task.checklist ?? []).filter(c => c.done).length
            const totalItems = (task.checklist ?? []).length
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => openEdit(task)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-surface-elevated transition-colors"
              >
                <div
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: task.status === 'completed'
                      ? 'rgb(var(--color-green))'
                      : task.status === 'in_progress'
                        ? 'rgb(var(--color-amber))'
                        : 'color-mix(in srgb, var(--color-secondary) 30%, transparent)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug ${task.status === 'completed' ? 'text-tertiary line-through' : 'text-primary'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-[11px]"
                      style={{
                        color: task.status === 'completed'
                          ? 'rgb(var(--color-green))'
                          : task.status === 'in_progress'
                            ? 'rgb(var(--color-amber))'
                            : undefined,
                      }}
                    >
                      {statusLabel(task.status, locale)}
                    </span>
                    {task.area && <span className="text-[11px] text-tertiary">{task.area}</span>}
                    {totalItems > 0 && <span className="text-[11px] text-tertiary">{doneItems}/{totalItems}</span>}
                    {task.due_date && (
                      <span className={`text-[11px] ${isOverdue ? 'text-danger font-medium' : 'text-tertiary'}`}>
                        {dueLabel} {fmtDate(task.due_date, locale)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Edit hint */}
                <span className="text-[11px] text-brand font-medium flex-shrink-0 mt-0.5">{tapHint}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Edit bottom sheet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeEdit}
          />

          {/* Sheet */}
          <div className="relative bg-surface rounded-t-[20px] max-h-[85vh] overflow-y-auto px-4 pt-4 pb-8">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-4" />

            <h3 className="text-base font-semibold text-primary mb-1 pr-8 leading-snug">{editing.title}</h3>
            {editing.area && <p className="text-xs text-secondary mb-4">{editing.area}</p>}

            {/* Status */}
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">{statusTitle}</p>
            <div className="flex gap-2 mb-5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditStatus(opt.value)}
                  className={`flex-1 py-2 rounded-[10px] text-xs font-semibold border transition-colors ${
                    editStatus === opt.value
                      ? opt.value === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : opt.value === 'in_progress'
                          ? 'bg-amber-400 border-amber-400 text-white'
                          : 'bg-brand border-brand text-white'
                      : 'border-[var(--border)] text-secondary'
                  }`}
                  style={editStatus === opt.value ? {
                    background: opt.value === 'completed'
                      ? 'rgb(var(--color-green))'
                      : opt.value === 'in_progress'
                        ? 'rgb(var(--color-amber))'
                        : 'rgb(var(--color-brand))',
                    borderColor: 'transparent',
                    color: 'white',
                  } : {}}
                >
                  {locale === 'pt' ? opt.labelPt : locale === 'es' ? opt.labelEs : opt.labelEn}
                </button>
              ))}
            </div>

            {/* Checklist */}
            {editChecklist.length > 0 && (
              <>
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">{checklistTitle}</p>
                <div className="bg-surface-elevated rounded-[12px] divide-y divide-[var(--border)] mb-5">
                  {editChecklist.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleCheckItem(i)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left active:opacity-70"
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.done ? 'border-transparent' : 'border-[var(--border)]'
                      }`} style={item.done ? { background: 'rgb(var(--color-green))', borderColor: 'transparent' } : {}}>
                        {item.done && (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm leading-snug ${item.done ? 'text-tertiary line-through' : 'text-primary'}`}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || saved}
              className="w-full py-3.5 rounded-[14px] text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saved ? 'rgb(var(--color-green))' : 'rgb(var(--color-brand))' }}
            >
              {saved ? savedLabel : isPending ? savingLabel : saveLabel}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
