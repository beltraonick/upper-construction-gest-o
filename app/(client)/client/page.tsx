import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { getCurrentUser } from '@/lib/auth/session'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

function statusBadge(s: string) {
  if (s === 'active') return <Badge variant="green">Active</Badge>
  if (s === 'completed') return <Badge variant="blue">Completed</Badge>
  return <Badge variant="amber">On Hold</Badge>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ClientPortalPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  const today = new Date()

  let projects: {
    id: string
    name: string
    status: string
    address: string | null
    progress: number | null
    project_type?: string | null
    created_at: string
    client_name: string | null
  }[] = []

  let recentPhotos: {
    id: string
    storage_path: string
    created_at: string
    project_id: string | null
  }[] = []

  let totalHoursThisWeek = 0

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const { data: projs } = await supabase
        .from('projects')
        .select('id, name, status, address, progress, project_type, created_at, client_name')
        .eq('company_id', COMPANY_ID)
        .eq('client_email', user.email)
        .order('updated_at', { ascending: false })

      projects = (projs ?? []) as typeof projects
      const projectIds = projects.map(p => p.id)

      const [{ data: photos }, { data: weekEntries }] = await Promise.all([
        projectIds.length > 0
          ? supabase
              .from('project_photos')
              .select('id, storage_path, created_at, project_id')
              .in('project_id', projectIds)
              .order('created_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [] }),
        projectIds.length > 0
          ? supabase
              .from('time_entries')
              .select('clock_in, clock_out')
              .in('project_id', projectIds)
              .gte('clock_in', weekStart.toISOString())
              .not('clock_out', 'is', null)
          : Promise.resolve({ data: [] }),
      ])

      recentPhotos = (photos ?? []) as typeof recentPhotos
      totalHoursThisWeek = (weekEntries ?? []).reduce((sum, e) => {
        return sum + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000
      }, 0)
    } catch {
      // silent
    }
  }

  const activeProjects = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const getPhotoUrl = (path: string) =>
    `${SUPABASE_URL}/storage/v1/object/public/project-photos/${path}`

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

      {/* Welcome */}
      <div className="mb-8">
        <p className="text-sm text-secondary">Welcome back,</p>
        <h1 className="text-2xl font-bold text-primary tracking-tight">{user.full_name}</h1>
        <p className="text-sm text-secondary mt-0.5">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{activeProjects.length}</p>
          <p className="text-xs text-secondary mt-0.5">Active Projects</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{completedProjects.length}</p>
          <p className="text-xs text-secondary mt-0.5">Completed</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{totalHoursThisWeek.toFixed(0)}h</p>
          <p className="text-xs text-secondary mt-0.5">This Week</p>
        </Card>
      </div>

      {/* Active projects */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-primary mb-3">Your Projects</h2>
        {!supabaseReady && (
          <Card>
            <p className="text-sm text-secondary text-center py-4">Connect Supabase to see your projects.</p>
          </Card>
        )}
        {supabaseReady && projects.length === 0 && (
          <Card>
            <p className="text-sm text-secondary text-center py-6">
              No project linked to this account yet. Contact your project manager to get access.
            </p>
          </Card>
        )}
        <div className="space-y-3">
          {projects.map(p => (
            <Card key={p.id} padding="none">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-semibold text-primary truncate">{p.name}</h3>
                      {statusBadge(p.status)}
                    </div>
                    <p className="text-sm text-secondary">
                      {p.address || 'Location TBD'}
                      {p.project_type && p.project_type !== 'other' && (
                        <span className="ml-2 text-tertiary capitalize">· {p.project_type}</span>
                      )}
                    </p>
                  </div>
                </div>

                {p.status === 'active' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-secondary">Progress</span>
                      <span className="text-xs font-semibold text-primary">{p.progress ?? 0}%</span>
                    </div>
                    <ProgressBar value={p.progress ?? 0} />
                  </div>
                )}

                <p className="text-xs text-tertiary mt-3">Started {fmtDate(p.created_at)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent photos */}
      {recentPhotos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-primary mb-3">Recent Photos</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {recentPhotos.map(photo => (
              <div
                key={photo.id}
                className="aspect-square rounded-button overflow-hidden bg-surface-elevated cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt="Project photo"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-tertiary text-center mt-12">
        Powered by Orbit Workforce · For questions contact your project manager
      </p>
    </div>
  )
}
