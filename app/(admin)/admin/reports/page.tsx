'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface ReportRow {
  employee_id: string
  full_name: string
  email: string
  totalEntries: number
  totalHours: number
  regularHours: number
  overtimeHours: number
  approvedHours: number
  pendingHours: number
}

interface EntryRow {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  city: string | null
  state: string | null
  approval_status: string | null
  project: { name: string } | null
  profile: { full_name: string } | null
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const PERIOD_OPTIONS = [
  { value: 'week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all', label: 'All Time' },
]

function getPeriodStart(p: string): Date | null {
  const now = new Date()
  if (p === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0, 0, 0, 0); return d
  }
  if (p === 'last_week') {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay() - 7); d.setHours(0, 0, 0, 0); return d
  }
  if (p === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  if (p === 'last_month') {
    return new Date(now.getFullYear(), now.getMonth() - 1, 1)
  }
  return null
}

function getPeriodEnd(p: string): Date | null {
  const now = new Date()
  if (p === 'last_week') {
    const d = new Date(now); d.setDate(now.getDate() - now.getDay() - 1); d.setHours(23, 59, 59, 999); return d
  }
  if (p === 'last_month') {
    return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  }
  return null
}

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [profiles, setProfiles] = useState<{ id: string; hourly_rate: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [view, setView] = useState<'summary' | 'detail'>('summary')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = getPeriodStart(period)
    const end = getPeriodEnd(period)

    let query = supabase
      .from('time_entries')
      .select('id, employee_id, clock_in, clock_out, city, state, approval_status, project:project_id(name), profile:employee_id(full_name, email)')
      .eq('company_id', COMPANY_ID)
      .order('clock_in', { ascending: false })
      .limit(500)

    if (start) query = query.gte('clock_in', start.toISOString())
    if (end) query = query.lte('clock_in', end.toISOString())

    const [{ data: ents }, { data: profs }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name, email, hourly_rate').eq('company_id', COMPANY_ID),
    ])

    const fetchedEntries = (ents ?? []) as unknown as EntryRow[]
    setEntries(fetchedEntries)
    setProfiles((profs ?? []) as { id: string; hourly_rate: number }[])

    // Build summary
    const empMap = new Map<string, ReportRow>()
    for (const e of fetchedEntries) {
      if (!e.profile) continue
      if (!empMap.has(e.employee_id)) {
        empMap.set(e.employee_id, {
          employee_id: e.employee_id,
          full_name: (e.profile as unknown as { full_name: string }).full_name ?? '',
          email: (e.profile as unknown as { email: string }).email ?? '',
          totalEntries: 0,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          approvedHours: 0,
          pendingHours: 0,
        })
      }
      const row = empMap.get(e.employee_id)!
      row.totalEntries++
      if (e.clock_out) {
        const h = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000
        row.totalHours += h
        const status = e.approval_status ?? 'approved'
        if (status === 'approved') row.approvedHours += h
        if (status === 'pending') row.pendingHours += h
      }
    }

    // Calc OT per employee (weekly threshold handled simply as >40h in period)
    const allRows = Array.from(empMap.values())
    for (const row of allRows) {
      row.regularHours = Math.min(row.totalHours, 40)
      row.overtimeHours = Math.max(row.totalHours - 40, 0)
    }

    setRows(allRows.sort((a, b) => b.totalHours - a.totalHours))
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  const rateMap = new Map(profiles.map(p => [p.id, Number(p.hourly_rate)]))
  const grandHours = rows.reduce((s, r) => s + r.totalHours, 0)
  const grandPay = rows.reduce((s, r) => {
    const rate = rateMap.get(r.employee_id) ?? 0
    return s + r.regularHours * rate + r.overtimeHours * rate * 1.5
  }, 0)

  function printPage() { window.print() }

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Reports</h1>
          <p className="text-sm text-secondary mt-1">Hours and earnings overview</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-40">
            <Select
              options={PERIOD_OPTIONS}
              value={period}
              onChange={e => setPeriod(e.target.value)}
            />
          </div>
          <div className="flex rounded-button border border-[rgba(255,255,255,0.08)] overflow-hidden">
            {(['summary', 'detail'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-3 py-2 text-xs font-medium capitalize transition-colors',
                  view === v ? 'bg-brand text-white' : 'text-secondary hover:text-primary hover:bg-surface-elevated',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={printPage}
            className="px-3 py-2 rounded-button border border-[rgba(255,255,255,0.08)] text-xs font-medium text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
          >
            Print
          </button>
        </div>
      </div>

      {/* Top summary */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Employees</p>
            <p className="text-2xl font-bold text-primary">{rows.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-primary">{grandHours.toFixed(1)}h</p>
          </Card>
          <Card>
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Est. Payroll</p>
            <p className="text-2xl font-bold text-primary">{fmt(grandPay)}</p>
          </Card>
          <Card>
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Entries</p>
            <p className="text-2xl font-bold text-primary">{entries.length}</p>
          </Card>
        </div>
      )}

      {view === 'summary' ? (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-sm font-semibold text-primary">By Employee</h2>
          </div>
          {loading ? (
            <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-sm text-secondary text-center">No data for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.07)]">
                    <th className="text-left px-5 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Employee</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Entries</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Regular</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Overtime</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Est. Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {rows.map(r => {
                    const rate = rateMap.get(r.employee_id) ?? 0
                    const pay = r.regularHours * rate + r.overtimeHours * rate * 1.5
                    return (
                      <tr key={r.employee_id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-primary">{r.full_name}</p>
                          <p className="text-xs text-tertiary">{r.email}</p>
                        </td>
                        <td className="text-right px-4 py-3 text-secondary tabular-nums">{r.totalEntries}</td>
                        <td className="text-right px-4 py-3 text-secondary tabular-nums">{r.regularHours.toFixed(1)}h</td>
                        <td className="text-right px-4 py-3 tabular-nums">
                          {r.overtimeHours > 0
                            ? <span className="text-amber">{r.overtimeHours.toFixed(1)}h</span>
                            : <span className="text-tertiary">—</span>}
                        </td>
                        <td className="text-right px-5 py-3 font-semibold text-primary tabular-nums">{fmt(pay)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-sm font-semibold text-primary">All Entries</h2>
          </div>
          {loading ? (
            <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="px-5 py-10 text-sm text-secondary text-center">No entries for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.07)]">
                    <th className="text-left px-5 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Location</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-tertiary uppercase tracking-wide">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {entries.map(e => {
                    const hours = e.clock_out
                      ? (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000
                      : null
                    return (
                      <tr key={e.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-3 font-medium text-primary whitespace-nowrap">
                          {(e.profile as unknown as { full_name: string } | null)?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-secondary whitespace-nowrap">
                          {new Date(e.clock_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-secondary whitespace-nowrap tabular-nums">
                          {new Date(e.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {e.clock_out && ` → ${new Date(e.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                        </td>
                        <td className="px-4 py-3 text-secondary text-xs">
                          {[e.city, e.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="text-right px-5 py-3 tabular-nums">
                          {hours != null
                            ? <span className="font-semibold text-primary">{hours.toFixed(2)}h</span>
                            : <span className="text-green text-xs">Active</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
