'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

interface EmployeeSummary {
  id: string
  full_name: string
  email: string
  hourly_rate: number
  regularHours: number
  overtimeHours: number
  totalHours: number
  regularPay: number
  overtimePay: number
  totalPay: number
}

interface PayrollRecord {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  total_hours: number
  hourly_rate: number
  total_amount: number
  status: string
  profile: { full_name: string } | null
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date()
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (period === 'last_week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay() - 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

const PERIOD_OPTIONS = [
  { value: 'week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
]

export default function PayrollPage() {
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([])
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [period, setPeriod] = useState('week')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getPeriodDates(period)

    const [{ data: profiles }, { data: entries }, { data: histRecords }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, hourly_rate').eq('company_id', COMPANY_ID).eq('status', 'active'),
      supabase.from('time_entries')
        .select('employee_id, clock_in, clock_out')
        .eq('company_id', COMPANY_ID)
        .not('clock_out', 'is', null)
        .gte('clock_in', start.toISOString())
        .lte('clock_in', end.toISOString()),
      supabase.from('payroll_records')
        .select('*, profile:employee_id(full_name)')
        .eq('company_id', COMPANY_ID)
        .order('period_start', { ascending: false })
        .limit(20),
    ])

    const empMap = new Map((profiles ?? []).map(p => [p.id, p]))
    const hoursMap = new Map<string, number>()

    for (const e of (entries ?? [])) {
      const h = (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000
      hoursMap.set(e.employee_id, (hoursMap.get(e.employee_id) ?? 0) + h)
    }

    const result: EmployeeSummary[] = (profiles ?? [])
      .filter(p => hoursMap.has(p.id))
      .map(p => {
        const totalHours = hoursMap.get(p.id) ?? 0
        const rate = Number(p.hourly_rate) || 0
        const regularHours = Math.min(totalHours, 40)
        const overtimeHours = Math.max(totalHours - 40, 0)
        const regularPay = regularHours * rate
        const overtimePay = overtimeHours * rate * 1.5
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          hourly_rate: rate,
          regularHours,
          overtimeHours,
          totalHours,
          regularPay,
          overtimePay,
          totalPay: regularPay + overtimePay,
        }
      })
      .sort((a, b) => b.totalPay - a.totalPay)

    setSummaries(result)
    setRecords((histRecords ?? []) as unknown as PayrollRecord[])
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  async function closePayroll() {
    if (summaries.length === 0) return
    const ok = window.confirm(`Close payroll for ${summaries.length} employee(s)? This creates payroll records.`)
    if (!ok) return

    setClosing(true)
    const supabase = createClient()
    const { start, end } = getPeriodDates(period)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)

    await supabase.from('payroll_records').insert(
      summaries.map(s => ({
        company_id: COMPANY_ID,
        employee_id: s.id,
        period_start: startStr,
        period_end: endStr,
        total_hours: Math.round(s.totalHours * 100) / 100,
        hourly_rate: s.hourly_rate,
        total_amount: Math.round(s.totalPay * 100) / 100,
        status: 'pending',
      }))
    )

    setClosing(false)
    load()
  }

  const totalPayout = summaries.reduce((s, e) => s + e.totalPay, 0)
  const totalHours = summaries.reduce((s, e) => s + e.totalHours, 0)

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Payroll</h1>
          <p className="text-sm text-secondary mt-1">Calculate and close pay periods</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <Select
              options={PERIOD_OPTIONS}
              value={period}
              onChange={e => setPeriod(e.target.value)}
            />
          </div>
          {summaries.length > 0 && (
            <Button onClick={closePayroll} loading={closing}>
              Close Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && summaries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Card>
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Total Employees</p>
            <p className="text-2xl font-bold text-primary">{summaries.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}h</p>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <p className="text-xs text-secondary uppercase tracking-wide mb-1">Total Payout</p>
            <p className="text-2xl font-bold text-primary">{fmt(totalPayout)}</p>
          </Card>
        </div>
      )}

      {/* Per-employee breakdown */}
      <Card padding="none" className="mb-6">
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-sm font-semibold text-primary">Employee Breakdown</h2>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">Loading…</p>
        ) : summaries.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            No completed time entries for this period.
          </p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {summaries.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">{s.full_name}</p>
                  <p className="text-xs text-secondary mt-0.5">
                    {s.totalHours.toFixed(1)}h total
                    {s.overtimeHours > 0 && (
                      <span className="text-amber ml-1">· {s.overtimeHours.toFixed(1)}h OT</span>
                    )}
                    {' · '}{fmt(s.hourly_rate)}/hr
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-primary">{fmt(s.totalPay)}</p>
                  {s.overtimeHours > 0 && (
                    <p className="text-xs text-tertiary">
                      {fmt(s.regularPay)} + {fmt(s.overtimePay)} OT
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payroll history */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-sm font-semibold text-primary">Payroll History</h2>
        </div>
        {records.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            No payroll records yet. Close a pay period to generate records.
          </p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {records.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {(r.profile as unknown as { full_name: string } | null)?.full_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-secondary mt-0.5">
                    {new Date(r.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(r.period_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}{Number(r.total_hours).toFixed(1)}h
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{fmt(Number(r.total_amount))}</span>
                  {r.status === 'paid'
                    ? <Badge variant="green">Paid</Badge>
                    : <Badge variant="amber">Pending</Badge>}
                </div>
                {r.status !== 'paid' && (
                  <button
                    onClick={async () => {
                      const supabase = createClient()
                      await supabase.from('payroll_records').update({ status: 'paid' }).eq('id', r.id)
                      load()
                    }}
                    className="text-xs px-2 py-1 rounded-button bg-green/10 text-green hover:bg-green/20 transition-colors flex-shrink-0"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
