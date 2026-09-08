'use client'

import { useState, useTransition, useEffect } from 'react'
import { markAuditLogsRead } from '@/app/actions/employeeTasks'

type Change = {
  field: string
  old_value: unknown
  new_value: unknown
}

type AuditEntry = {
  id: string
  task_title: string | null
  changed_by_name: string | null
  changes: Change[]
  created_at: string
}

type Props = {
  entries: AuditEntry[]
  companyId: string
  locale: string
  onRead?: () => void
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  pending:     { pt: 'Pendente',     en: 'Pending',     es: 'Pendiente' },
  in_progress: { pt: 'Em andamento', en: 'In progress', es: 'En progreso' },
  completed:   { pt: 'Concluído',    en: 'Completed',   es: 'Completado' },
}

function fmtStatus(val: unknown, locale: string) {
  if (typeof val !== 'string') return String(val)
  return STATUS_LABELS[val]?.[locale] ?? val
}

function fmtChange(change: Change, locale: string) {
  if (change.field === 'status') {
    return `Status: ${fmtStatus(change.old_value, locale)} → ${fmtStatus(change.new_value, locale)}`
  }
  if (change.field === 'checklist') {
    const oldArr = Array.isArray(change.old_value) ? change.old_value as { done: boolean }[] : []
    const newArr = Array.isArray(change.new_value) ? change.new_value as { done: boolean }[] : []
    const oldDone = oldArr.filter(c => c.done).length
    const newDone = newArr.filter(c => c.done).length
    const label = locale === 'pt' ? 'Checklist' : 'Checklist'
    return `${label}: ${oldDone}/${oldArr.length} → ${newDone}/${newArr.length}`
  }
  return `${change.field}: ${String(change.old_value)} → ${String(change.new_value)}`
}

function timeAgo(iso: string, locale: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return locale === 'pt' ? 'agora' : 'just now'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return locale === 'pt' ? `${m}min atrás` : `${m}min ago`
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return locale === 'pt' ? `${h}h atrás` : `${h}h ago`
  }
  const d = Math.floor(diff / 86400)
  return locale === 'pt' ? `${d}d atrás` : `${d}d ago`
}

export function TaskAuditAlerts({ entries: initialEntries, companyId, locale, onRead }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [expanded, setExpanded] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Sync when parent re-fetches
  useEffect(() => { setEntries(initialEntries) }, [initialEntries])

  if (entries.length === 0) return null

  const title = locale === 'pt'
    ? `${entries.length} alteraç${entries.length === 1 ? 'ão' : 'ões'} por funcionários`
    : `${entries.length} employee change${entries.length === 1 ? '' : 's'}`

  const markReadLabel = locale === 'pt' ? 'Marcar como lido' : 'Mark as read'

  function handleMarkRead() {
    startTransition(async () => {
      await markAuditLogsRead(companyId)
      setEntries([])
      onRead?.()
    })
  }

  return (
    <div
      className="mb-4 rounded-[14px] border overflow-hidden"
      style={{
        borderColor: 'color-mix(in srgb, rgb(var(--color-amber)) 40%, transparent)',
        background: 'color-mix(in srgb, rgb(var(--color-amber)) 8%, var(--color-surface))',
      }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: 'rgb(var(--color-amber))' }}>
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-semibold text-primary">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleMarkRead() }}
            disabled={isPending}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors disabled:opacity-50"
          >
            {markReadLabel}
          </button>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-tertiary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Entry list */}
      {expanded && (
        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {entries.map(entry => (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <p className="text-sm font-medium text-primary leading-snug">{entry.task_title}</p>
                <span className="text-[11px] text-tertiary flex-shrink-0">{timeAgo(entry.created_at, locale)}</span>
              </div>
              <p className="text-[11px] text-secondary mb-1">{entry.changed_by_name ?? '—'}</p>
              <div className="space-y-0.5">
                {(entry.changes ?? []).map((c, i) => (
                  <p key={i} className="text-xs text-secondary">{fmtChange(c, locale)}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
