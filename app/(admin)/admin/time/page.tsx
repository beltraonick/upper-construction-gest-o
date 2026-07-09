'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface TimeEntry {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  city: string | null
  state: string | null
  approval_status: string | null
  project: { name: string } | null
  profile: { full_name: string; email: string } | null
}

const FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

function calcHours(clockIn: string, clockOut: string | null) {
  if (!clockOut) return null
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getRange(filter: string): Date | null {
  const now = new Date()
  if (filter === 'today') {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }
  if (filter === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0, 0, 0, 0); return d
  }
  if (filter === 'month') {
    const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d
  }
  return null
}

export default function TimePage() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [filter, setFilter] = useState('week')
  const [empFilter, setEmpFilter] = useState('')
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const rangeStart = getRange(filter)

    let query = supabase
      .from('time_entries')
      .select('id, employee_id, clock_in, clock_out, city, state, approval_status, project:project_id(name), profile:employee_id(full_name, email)')
      .eq('company_id', COMPANY_ID)
      .order('clock_in', { ascending: false })
      .limit(200)

    if (rangeStart) query = query.gte('clock_in', rangeStart.toISOString())
    if (empFilter) query = query.eq('employee_id', empFilter)

    const [{ data }, { data: emps }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name').eq('company_id', COMPANY_ID).eq('status', 'active').order('full_name'),
    ])

    setEntries((data ?? []) as unknown as TimeEntry[])
    setEmployees(emps ?? [])
    setLoading(false)
  }, [filter, empFilter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setActionId(id)
    const supabase = createClient()
    await supabase.from('time_entries').update({ approval_status: 'approved' }).eq('id', id)
    load()
    setActionId(null)
  }

  async function reject(id: string) {
    setActionId(id)
    const supabase = createClient()
    await supabase.from('time_entries').update({ approval_status: 'rejected' }).eq('id', id)
    load()
    setActionId(null)
  }

  async function clockOut(id: string) {
    setActionId(id)
    const supabase = createClient()
    await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', id)
    load()
    setActionId(null)
  }

  const empOptions = [
    { value: '', label: 'All employees' },
    ...employees.map(e => ({ value: e.id, label: e.full_name })),
  ]

  const pendingCount = entries.filter(e => e.approval_status === 'pending' && e.clock_out).length
  const activeCount = entries.filter(e => !e.clock_out).length
  const totalHours = entries.reduce((sum, e) => sum + (calcHours(e.clock_in, e.clock_out) ?? 0), 0)

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Time & Attendance</h1>
        <p className="text-sm text-secondary mt-1">
          {activeCount > 0 && `${activeCount} clocked in · `}
          {totalHours.toFixed(1)}h total · {pendingCount > 0 && <span className="text-amber">{pendingCount} pending approval</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="w-40">
          <Select
            options={FILTER_OPTIONS}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="w-52">
          <Select
            options={empOptions}
            value={empFilter}
            onChange={e => setEmpFilter(e.target.value)}
          />
        </div>
      </div>

      <Card padding="none">
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">No entries for this period.</p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {entries.map(e => {
              const hours = calcHours(e.clock_in, e.clock_out)
              const status = e.clock_out ? (e.approval_status ?? 'approved') : 'active'
              const isActing = actionId === e.id
              return (
                <div key={e.id} className="px-5 py-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-primary">
                        {e.profile?.full_name ?? 'Unknown'}
                      </p>
                      {status === 'active' && <Badge variant="green">Active</Badge>}
                      {status === 'pending' && <Badge variant="amber">Pending</Badge>}
                      {status === 'rejected' && <Badge variant="gray">Rejected</Badge>}
                    </div>
                    <p className="text-xs text-secondary mt-0.5">
                      {fmtDate(e.clock_in)} · {fmtTime(e.clock_in)}
                      {e.clock_out ? ` → ${fmtTime(e.clock_out)}` : ' — In progress'}
                    </p>
                    {(e.city || e.project?.name) && (
                      <p className="text-xs text-tertiary mt-0.5 truncate">
                        {e.project?.name ?? ''}
                        {e.city ? ` · ${e.city}${e.state ? `, ${e.state}` : ''}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {hours != null && (
                      <span className="text-sm font-semibold text-primary tabular-nums">
                        {hours.toFixed(2)}h
                      </span>
                    )}
                    <div className="flex gap-1.5">
                      {!e.clock_out && (
                        <button
                          onClick={() => clockOut(e.id)}
                          disabled={isActing}
                          className="text-xs px-2 py-1 rounded-button bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
                        >
                          Clock Out
                        </button>
                      )}
                      {status === 'pending' && (
                        <>
                          <button
                            onClick={() => approve(e.id)}
                            disabled={isActing}
                            className="text-xs px-2 py-1 rounded-button bg-green/10 text-green hover:bg-green/20 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reject(e.id)}
                            disabled={isActing}
                            className="text-xs px-2 py-1 rounded-button bg-surface-elevated text-secondary hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
