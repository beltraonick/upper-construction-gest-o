import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { logout } from '@/app/actions/auth'
import { ClockButtons } from './ClockButtons'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function EmployeeHomePage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  let profileId: string | null = null
  let openEntryId: string | null = null
  let clockInTime: string | null = null
  let weekHours = 0
  let weekEarnings = 0
  let tasks: {
    id: string
    title: string
    priority: string
    project: { name: string } | null
    area: string | null
  }[] = []

  if (supabaseReady) {
    try {
      const supabase = createClient()

      let { data: profile } = await supabase
        .from('profiles')
        .select('id, hourly_rate')
        .eq('email', user.email)
        .maybeSingle()

      if (!profile) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            company_id: COMPANY_ID,
            role: user.role,
            full_name: user.full_name,
            email: user.email,
            status: 'active',
          })
          .select('id, hourly_rate')
          .single()
        profile = newProfile
      }

      if (profile) {
        profileId = profile.id

        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const [{ data: openEntry }, { data: weekEntries }, { data: myTasks }] = await Promise.all([
          supabase
            .from('time_entries')
            .select('id, clock_in')
            .eq('employee_id', profile.id)
            .is('clock_out', null)
            .order('clock_in', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('time_entries')
            .select('clock_in, clock_out')
            .eq('employee_id', profile.id)
            .gte('clock_in', weekStart.toISOString())
            .not('clock_out', 'is', null),
          supabase
            .from('tasks')
            .select('id, title, priority, area, project:project_id(name)')
            .eq('assigned_to', profile.id)
            .neq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(3),
        ])

        if (openEntry) {
          openEntryId = openEntry.id
          clockInTime = openEntry.clock_in
        }

        weekHours = (weekEntries ?? []).reduce((sum, e) => {
          return sum + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000
        }, 0)

        const hourlyRate = Number(profile.hourly_rate) || 0
        const regularHours = Math.min(weekHours, 40)
        const overtimeHours = Math.max(weekHours - 40, 0)
        weekEarnings = regularHours * hourlyRate + overtimeHours * hourlyRate * 1.5

        tasks = (myTasks ?? []) as unknown as typeof tasks
      }
    } catch {
      // silent fallback
    }
  }

  const PRIORITY_DOT: Record<string, string> = {
    urgent: 'bg-danger',
    high: 'bg-danger/60',
    medium: 'bg-amber',
    low: 'bg-blue',
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:py-8">

      {/* Greeting */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={user.full_name} size="xl" />
        <div className="flex-1">
          <p className="text-sm text-secondary">{greeting},</p>
          <h1 className="text-2xl font-bold text-primary tracking-tight">{user.full_name}</h1>
          <p className="text-sm text-secondary">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="p-2 rounded-button text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            title="Sign out"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </div>

      {/* Clock In/Out */}
      <Card className="mb-5">
        {profileId ? (
          <ClockButtons
            employeeId={profileId}
            openEntryId={openEntryId}
            clockInTime={clockInTime}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm text-secondary">
              {supabaseReady ? 'Setting up your profile…' : 'Supabase not connected'}
            </p>
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 font-medium rounded-button bg-brand text-white h-12 px-6 text-base w-full disabled:opacity-40"
            >
              Clock In
            </button>
          </div>
        )}
      </Card>

      {/* Week Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">Hours This Week</p>
          <p className="text-2xl font-bold text-primary">
            {supabaseReady && profileId ? `${weekHours.toFixed(1)}h` : '—'}
          </p>
          {weekHours > 40 && (
            <p className="text-xs text-amber mt-0.5">{(weekHours - 40).toFixed(1)}h overtime</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">Earnings This Week</p>
          <p className="text-2xl font-bold text-primary">
            {supabaseReady && profileId && weekEarnings > 0
              ? `$${weekEarnings.toFixed(0)}`
              : '—'}
          </p>
          {weekEarnings > 0 && (
            <p className="text-xs text-secondary mt-0.5">projected</p>
          )}
        </Card>
      </div>

      {/* My Tasks preview */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-sm font-semibold text-primary">My Tasks</h2>
          <Link href="/tasks" className="text-xs text-brand hover:text-brand-hover font-medium transition-colors">
            View all →
          </Link>
        </div>

        {!supabaseReady && (
          <p className="px-5 py-6 text-sm text-secondary text-center">Connect Supabase to see tasks.</p>
        )}

        {supabaseReady && tasks.length === 0 && (
          <div className="px-5 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-secondary">No open tasks</p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {tasks.map(t => (
              <Link key={t.id} href="/tasks" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-elevated transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-secondary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{t.title}</p>
                  {t.project?.name && (
                    <p className="text-xs text-secondary truncate">{t.project.name}{t.area ? ` · ${t.area}` : ''}</p>
                  )}
                </div>
                <Badge variant={t.priority === 'urgent' ? 'gray' : t.priority === 'high' ? 'gray' : 'gray'}>
                  {t.priority}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
