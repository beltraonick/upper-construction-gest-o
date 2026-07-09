import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/server'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

function calcHours(clockIn: string, clockOut: string | null) {
  if (!clockOut) return null
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000
}

export default async function PontoPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let entries: any[] = []
  let weekHours = 0
  let monthHours = 0

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (profile) {
        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from('time_entries')
          .select('id, clock_in, clock_out, city, state, approval_status, project:project_id(name)')
          .eq('employee_id', profile.id)
          .order('clock_in', { ascending: false })
          .limit(90)

        entries = data ?? []

        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)

        for (const e of entries) {
          const h = calcHours(e.clock_in, e.clock_out)
          if (h == null) continue
          if (new Date(e.clock_in) >= weekStart) weekHours += h
          if (new Date(e.clock_in) >= monthStart) monthHours += h
        }
      }
    } catch {
      // silent fallback
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold text-primary mb-1">Time & Attendance</h1>
      <p className="text-sm text-secondary mb-6">Your clock-in / clock-out history</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">This Week</p>
          <p className="text-2xl font-bold text-primary">
            {weekHours > 0 ? `${weekHours.toFixed(1)}h` : '—'}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">This Month</p>
          <p className="text-2xl font-bold text-primary">
            {monthHours > 0 ? `${monthHours.toFixed(1)}h` : '—'}
          </p>
        </Card>
      </div>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-sm font-semibold text-primary">Recent Entries</h2>
        </div>

        {entries.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">
            {supabaseReady ? 'No time entries yet.' : 'Connect Supabase to see history.'}
          </p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {entries.map((e: any) => {
              const hours = calcHours(e.clock_in, e.clock_out)
              const status = e.approval_status ?? 'approved'
              const inTime = new Date(e.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              const outTime = e.clock_out
                ? new Date(e.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : null
              return (
                <div key={e.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary">
                      {new Date(e.clock_in).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-secondary mt-0.5">
                      {inTime}{outTime ? ` → ${outTime}` : ' — In progress'}
                    </p>
                    {(e.city || e.project?.name) && (
                      <p className="text-xs text-tertiary mt-0.5 truncate">
                        {e.project?.name ?? ''}
                        {e.city ? ` · ${e.city}${e.state ? `, ${e.state}` : ''}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {hours != null && (
                      <span className="text-sm font-semibold text-primary tabular-nums">
                        {hours.toFixed(2)}h
                      </span>
                    )}
                    {!e.clock_out && <Badge variant="green">Active</Badge>}
                    {e.clock_out && status === 'pending' && <Badge variant="amber">Pending</Badge>}
                    {status === 'rejected' && <Badge variant="gray">Rejected</Badge>}
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
