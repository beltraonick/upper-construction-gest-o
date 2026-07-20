import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { OrbitAIHub } from '@/components/OrbitAIHub'

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
      <p className="text-2xl md:text-3xl font-bold text-primary tracking-tight">{value}</p>
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
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
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

export default async function AdminDashboardPage() {
  const stats = await fetchStats()
  const today = new Date()
  const weeklyPayroll = stats?.pendingPayroll?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: 'green' | 'amber' | 'blue' | 'gray' }> = {
      active: { label: 'Active', variant: 'green' },
      on_hold: { label: 'On Hold', variant: 'amber' },
      completed: { label: 'Completed', variant: 'blue' },
      cancelled: { label: 'Cancelled', variant: 'gray' },
    }
    const c = map[s] ?? { label: s, variant: 'gray' as const }
    return <Badge variant={c.variant}>{c.label}</Badge>
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-sm text-secondary mt-1">
          {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {!supabaseReady && (
        <div className="mb-5 md:mb-6 bg-amber/5 border border-amber/20 rounded-card px-4 py-3 md:px-5 md:py-4 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber">Supabase not connected</p>
            <p className="text-xs text-secondary mt-0.5">
              Add credentials to <code className="bg-surface-elevated px-1 py-0.5 rounded text-[11px]">.env.local</code> to see live data. Auth and navigation are fully functional.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard label="Clocked In Today" value={stats?.todayClockedIn?.length ?? '—'} sub={stats ? `of ${stats.totalEmployees ?? 0} employees` : 'Connect Supabase'} color="green" />
        <StatCard label="Active Projects" value={stats?.activeProjects ?? '—'} sub={stats ? 'in progress' : 'Connect Supabase'} />
        <StatCard label="Pending Payroll" value={stats ? `$${weeklyPayroll.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'} sub={stats ? 'awaiting payment' : 'Connect Supabase'} color="amber" />
        <StatCard label="Total Employees" value={stats?.totalEmployees ?? '—'} sub={stats ? 'active workers' : 'Connect Supabase'} />
      </div>

      {/* Orbit AI Hub */}
      <OrbitAIHub />

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        <div className="lg:col-span-3">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-primary">Active Projects</h2>
              <a href="/admin/projects" className="text-xs text-brand hover:text-brand-hover font-medium transition-colors">View all →</a>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {!stats && <p className="px-5 py-8 text-sm text-secondary text-center">Connect Supabase to see projects.</p>}
              {stats?.recentProjects?.length === 0 && <p className="px-5 py-8 text-sm text-secondary text-center">No active projects yet.</p>}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(stats?.recentProjects as any[])?.map(p => (
                <a key={p.id} href={`/admin/projects/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-elevated transition-colors">
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

        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-primary">Clocked In Now</h2>
              <span className="flex items-center gap-1.5 text-xs text-green font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" /> Live
              </span>
            </div>
            {!stats && <p className="px-5 py-6 text-sm text-secondary text-center">Connect Supabase.</p>}
            {stats?.todayClockedIn?.length === 0 && <p className="px-5 py-6 text-sm text-secondary text-center">No one clocked in.</p>}
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(stats?.todayClockedIn as any[])?.slice(0, 5).map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={e.profiles?.full_name ?? '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{e.profiles?.full_name}</p>
                    <p className="text-xs text-secondary truncate">{e.profiles?.position ?? 'Worker'}</p>
                  </div>
                  <Badge variant="green">In</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-sm font-semibold text-primary">Recent Hours</h2>
              <a href="/admin/time" className="text-xs text-brand hover:text-brand-hover font-medium transition-colors">View all →</a>
            </div>
            {!stats && <p className="px-5 py-6 text-sm text-secondary text-center">Connect Supabase.</p>}
            {stats?.recentTimeEntries?.length === 0 && <p className="px-5 py-6 text-sm text-secondary text-center">No entries this week.</p>}
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(stats?.recentTimeEntries as any[])?.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={e.profiles?.full_name ?? '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{e.profiles?.full_name}</p>
                    <p className="text-xs text-secondary">
                      {new Date(e.clock_in).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {e.hours_worked != null ? `${Number(e.hours_worked).toFixed(1)}h` : '—'}
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
