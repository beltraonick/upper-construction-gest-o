import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'

function StatCard({ label, value, sub, color = 'default' }: {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'green' | 'amber' | 'red'
}) {
  const subColors = { default: 'text-secondary', green: 'text-green', amber: 'text-amber', red: 'text-danger' }
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-primary tracking-tight">{value}</p>
      {sub && <p className={['text-xs font-medium', subColors[color]].join(' ')}>{sub}</p>}
    </Card>
  )
}

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

async function fetchStats() {
  if (!supabaseReady) return null

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const [
      { count: totalEmployees },
      { count: activeProjects },
      { data: todayClockedIn },
      { data: recentProjects },
      { data: recentTimeEntries },
      { data: pendingPayroll },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee').eq('status', 'active'),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('time_entries').select('id, employee_id, profiles(full_name, avatar_url, position)').is('clock_out', null),
      supabase.from('projects').select('id, name, client_name, progress, status').eq('status', 'active').order('updated_at', { ascending: false }).limit(5),
      supabase.from('time_entries').select('id, hours_worked, clock_in, profiles(full_name, avatar_url)').gte('clock_in', weekStart.toISOString()).order('clock_in', { ascending: false }).limit(6),
      supabase.from('payroll_records').select('total_amount').eq('status', 'pending'),
    ])

    return { totalEmployees, activeProjects, todayClockedIn, recentProjects, recentTimeEntries, pendingPayroll }
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const stats = await fetchStats()
  const today = new Date()
  const weeklyPayroll = stats?.pendingPayroll?.reduce((sum, r) => sum + Number(r.total_amount), 0) ?? 0

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: 'green' | 'amber' | 'blue' | 'gray' }> = {
      active: { label: 'Active', variant: 'green' },
      on_hold: { label: 'On Hold', variant: 'amber' },
      completed: { label: 'Completed', variant: 'blue' },
      cancelled: { label: 'Cancelled', variant: 'gray' },
    }
    const config = map[s] ?? { label: s, variant: 'gray' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="p-8 max-w-[1400px]">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-sm text-secondary mt-1">
          {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Supabase not configured banner */}
      {!supabaseReady && (
        <div className="mb-6 bg-amber/5 border border-amber/20 rounded-card px-5 py-4 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber">Supabase not connected</p>
            <p className="text-xs text-secondary mt-0.5">
              Add your credentials to <code className="bg-surface-elevated px-1 py-0.5 rounded text-[11px]">.env.local</code> to see live data. Auth and navigation are fully functional.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Clocked In Today" value={stats?.todayClockedIn?.length ?? '—'} sub={stats ? `of ${stats.totalEmployees ?? 0} employees` : 'Connect Supabase'} color="green" />
        <StatCard label="Active Projects" value={stats?.activeProjects ?? '—'} sub={stats ? 'in progress' : 'Connect Supabase'} />
        <StatCard label="Pending Payroll" value={stats ? `$${weeklyPayroll.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} sub={stats ? 'awaiting payment' : 'Connect Supabase'} color="amber" />
        <StatCard label="Total Employees" value={stats?.totalEmployees ?? '—'} sub={stats ? 'active workers' : 'Connect Supabase'} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-6">

        {/* Projects overview */}
        <div className="col-span-3">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-primary">Active Projects</h2>
              <a href="/projects" className="text-xs text-brand hover:text-brand-hover font-medium transition-colors">View all →</a>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {!stats && (
                <p className="px-5 py-8 text-sm text-secondary text-center">Connect Supabase to see projects.</p>
              )}
              {stats?.recentProjects?.length === 0 && (
                <p className="px-5 py-8 text-sm text-secondary text-center">No active projects yet.</p>
              )}
              {(stats?.recentProjects as { id: string; name: string; client_name: string | null; progress: number; status: string }[] | undefined)?.map(p => (
                <a key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-elevated transition-colors block">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{p.name}</p>
                    <p className="text-xs text-secondary mt-0.5 truncate">{p.client_name ?? 'No client'}</p>
                  </div>
                  <div className="w-32 flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs text-secondary">Progress</span>
                      <span className="text-xs font-medium text-primary">{p.progress}%</span>
                    </div>
                    <ProgressBar value={p.progress} />
                  </div>
                  {statusBadge(p.status)}
                </a>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="col-span-2 flex flex-col gap-6">

          {/* Clocked in now */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-primary">Clocked In Now</h2>
              <span className="flex items-center gap-1.5 text-xs text-green font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                Live
              </span>
            </div>
            {!stats && <p className="px-5 py-6 text-sm text-secondary text-center">Connect Supabase.</p>}
            {stats?.todayClockedIn?.length === 0 && <p className="px-5 py-6 text-sm text-secondary text-center">No one clocked in.</p>}
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {(stats?.todayClockedIn as { id: string; profiles: { full_name: string; avatar_url: string | null; position: string | null } | null }[] | undefined)?.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={entry.profiles?.full_name ?? '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{entry.profiles?.full_name}</p>
                    <p className="text-xs text-secondary truncate">{entry.profiles?.position ?? 'Worker'}</p>
                  </div>
                  <Badge variant="green">In</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent hours */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-primary">Recent Hours</h2>
              <a href="/time" className="text-xs text-brand hover:text-brand-hover font-medium transition-colors">View all →</a>
            </div>
            {!stats && <p className="px-5 py-6 text-sm text-secondary text-center">Connect Supabase.</p>}
            {stats?.recentTimeEntries?.length === 0 && <p className="px-5 py-6 text-sm text-secondary text-center">No entries this week.</p>}
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {(stats?.recentTimeEntries as { id: string; hours_worked: number | null; clock_in: string; profiles: { full_name: string; avatar_url: string | null } | null }[] | undefined)?.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={entry.profiles?.full_name ?? '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{entry.profiles?.full_name}</p>
                    <p className="text-xs text-secondary">
                      {new Date(entry.clock_in).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {entry.hours_worked != null ? `${Number(entry.hours_worked).toFixed(1)}h` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
