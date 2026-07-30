import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/server'
import { t } from '@/lib/i18n/translate'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default async function PagamentoPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const locale = user.language

  let hourlyRate = 0
  let weekHours = 0
  let weekEarnings = 0
  let monthHours = 0
  let monthEarnings = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payrollRecords: any[] = []

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, hourly_rate')
        .eq('email', user.email)
        .maybeSingle()

      if (profile) {
        hourlyRate = Number(profile.hourly_rate) || 0

        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)

        const { data: entries } = await supabase
          .from('time_entries')
          .select('clock_in, clock_out')
          .eq('employee_id', profile.id)
          .not('clock_out', 'is', null)
          .gte('clock_in', monthStart.toISOString())

        for (const e of (entries ?? [])) {
          const h = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000
          monthHours += h
          monthEarnings += h * hourlyRate
          if (new Date(e.clock_in) >= weekStart) {
            weekHours += h
            weekEarnings += h * hourlyRate
          }
        }

        const { data: records } = await supabase
          .from('payroll_records')
          .select('*')
          .eq('employee_id', profile.id)
          .order('period_start', { ascending: false })
          .limit(12)

        payrollRecords = records ?? []
      }
    } catch {
      // silent fallback
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold text-primary mb-1">{t(locale, 'employee.pagamento.title')}</h1>
      <p className="text-sm text-secondary mb-6">
        {t(locale, 'employee.pagamento.rateLabel')} {hourlyRate > 0 ? `${fmt(hourlyRate)}/hr` : t(locale, 'employee.pagamento.rateNotConfigured')}
      </p>

      {/* Period summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">{t(locale, 'common.thisWeek')}</p>
          <p className="text-2xl font-bold text-primary">
            {weekEarnings > 0 ? fmt(weekEarnings) : '—'}
          </p>
          <p className="text-xs text-secondary mt-1">
            {weekHours > 0 ? t(locale, 'employee.pagamento.hoursWorked').replace('{n}', weekHours.toFixed(1)) : t(locale, 'employee.pagamento.noHoursYet')}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">{t(locale, 'common.thisMonth')}</p>
          <p className="text-2xl font-bold text-primary">
            {monthEarnings > 0 ? fmt(monthEarnings) : '—'}
          </p>
          <p className="text-xs text-secondary mt-1">
            {monthHours > 0 ? t(locale, 'employee.pagamento.hoursWorked').replace('{n}', monthHours.toFixed(1)) : t(locale, 'employee.pagamento.noHoursYet')}
          </p>
        </Card>
      </div>

      {/* Overtime indicator */}
      {weekHours > 40 && (
        <div className="mb-4 bg-amber/5 border border-amber/20 rounded-card px-4 py-3">
          <p className="text-xs font-semibold text-amber">{t(locale, 'employee.pagamento.overtimeThisWeek')}</p>
          <p className="text-xs text-secondary mt-0.5">
            {t(locale, 'employee.pagamento.overtimeDetail')
              .replace('{n}', (weekHours - 40).toFixed(1))
              .replace('{a}', fmt(40 * hourlyRate))
              .replace('{b}', fmt((weekHours - 40) * hourlyRate * 1.5))}
          </p>
        </div>
      )}

      {/* Payroll history */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-primary">{t(locale, 'employee.pagamento.payrollHistory')}</h2>
        </div>
        {payrollRecords.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-secondary">{t(locale, 'employee.pagamento.noPayrollRecords')}</p>
            <p className="text-xs text-tertiary mt-1">{t(locale, 'employee.pagamento.recordsAppearAfter')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {payrollRecords.map((r: any) => (
              <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {new Date(r.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(r.period_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-secondary mt-0.5">
                    {Number(r.total_hours).toFixed(1)}h · {fmt(Number(r.hourly_rate))}/hr
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className="text-base font-bold text-primary">{fmt(Number(r.total_amount))}</span>
                  {r.status === 'paid'
                    ? <Badge variant="green">{t(locale, 'employee.pagamento.paid')}</Badge>
                    : <Badge variant="amber">{t(locale, 'common.pending')}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
