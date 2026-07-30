import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { getCurrentUser } from '@/lib/auth/session'
import { t } from '@/lib/i18n/translate'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

function statusBadge(s: string, locale: 'en' | 'pt' | 'es') {
  if (s === 'active') return <Badge variant="green">{t(locale, 'client.overview.active')}</Badge>
  if (s === 'completed') return <Badge variant="blue">{t(locale, 'client.overview.completed')}</Badge>
  return <Badge variant="amber">{t(locale, 'client.overview.onHold')}</Badge>
}

function fmtDate(iso: string, locale: 'en' | 'pt' | 'es') {
  const dateLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US'
  return new Date(iso).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
}

function roomDotColor(roomId: string, tasks: { room_id: string | null; status: string }[]) {
  const linked = tasks.filter(t => t.room_id === roomId)
  if (linked.length === 0) return 'bg-tertiary/30'
  if (linked.every(t => t.status === 'completed')) return 'bg-green'
  if (linked.some(t => t.status !== 'pending')) return 'bg-amber'
  return 'bg-tertiary/30'
}

export default async function ClientPortalPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  const locale = user.language
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

  let rooms: { id: string; project_id: string; floor: string | null; label: string }[] = []
  let roomTasks: { room_id: string | null; status: string }[] = []

  let plan: { id: string; label: string; storage_path: string } | null = null
  let planPins: { id: string; title: string; status: string; pin_x: number; pin_y: number }[] = []

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
        .eq('company_id', user.company_id)
        .eq('client_email', user.email)
        .order('updated_at', { ascending: false })

      projects = (projs ?? []) as typeof projects
      const projectIds = projects.map(p => p.id)

      const [{ data: photos }, { data: weekEntries }, { data: roomRows }, { data: taskRows }] = await Promise.all([
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
        projectIds.length > 0
          ? supabase.from('project_rooms').select('id, project_id, floor, label').in('project_id', projectIds).order('floor').order('label')
          : Promise.resolve({ data: [] }),
        projectIds.length > 0
          ? supabase.from('tasks').select('room_id, status').in('project_id', projectIds)
          : Promise.resolve({ data: [] }),
      ])

      recentPhotos = (photos ?? []) as typeof recentPhotos
      rooms = (roomRows ?? []) as typeof rooms
      roomTasks = (taskRows ?? []) as typeof roomTasks
      totalHoursThisWeek = (weekEntries ?? []).reduce((sum, e) => {
        return sum + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000
      }, 0)

      if (projectIds.length > 0) {
        const { data: planRow } = await supabase
          .from('project_plans')
          .select('id, label, storage_path')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        plan = planRow ?? null
        if (plan) {
          const { data: pinRows } = await supabase
            .from('tasks')
            .select('id, title, status, pin_x, pin_y')
            .eq('plan_id', plan.id)
          planPins = (pinRows ?? []) as typeof planPins
        }
      }
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
        <p className="text-sm text-secondary">{t(locale, 'client.overview.welcomeBack')}</p>
        <h1 className="text-2xl font-bold text-primary tracking-tight">{user.full_name}</h1>
        <p className="text-sm text-secondary mt-0.5">
          {today.toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{activeProjects.length}</p>
          <p className="text-xs text-secondary mt-0.5">{t(locale, 'client.overview.activeProjects')}</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{completedProjects.length}</p>
          <p className="text-xs text-secondary mt-0.5">{t(locale, 'client.overview.completed')}</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{totalHoursThisWeek.toFixed(0)}h</p>
          <p className="text-xs text-secondary mt-0.5">{t(locale, 'client.overview.thisWeek')}</p>
        </Card>
      </div>

      {/* Active projects */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-primary mb-3">{t(locale, 'client.overview.yourProjects')}</h2>
        {!supabaseReady && (
          <Card>
            <p className="text-sm text-secondary text-center py-4">{t(locale, 'client.overview.connectSupabase')}</p>
          </Card>
        )}
        {supabaseReady && projects.length === 0 && (
          <Card>
            <p className="text-sm text-secondary text-center py-6">
              {t(locale, 'client.overview.noProjectLinked')}
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
                      {statusBadge(p.status, locale)}
                    </div>
                    <p className="text-sm text-secondary">
                      {p.address || t(locale, 'client.overview.locationTbd')}
                      {p.project_type && p.project_type !== 'other' && (
                        <span className="ml-2 text-tertiary capitalize">· {p.project_type}</span>
                      )}
                    </p>
                  </div>
                </div>

                {p.status === 'active' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-secondary">{t(locale, 'client.overview.progress')}</span>
                      <span className="text-xs font-semibold text-primary">{p.progress ?? 0}%</span>
                    </div>
                    <ProgressBar value={p.progress ?? 0} />
                  </div>
                )}

                <p className="text-xs text-tertiary mt-3">{t(locale, 'client.overview.started')} {fmtDate(p.created_at, locale)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Floor plan */}
      {plan && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-primary mb-3">{t(locale, 'client.overview.floorPlan')}</h2>
          <Card padding="none" className="overflow-hidden">
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getPhotoUrl(plan.storage_path)} alt={plan.label} className="w-full h-auto block" />
              {planPins.map(p => (
                <span
                  key={p.id}
                  title={p.title}
                  className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-lg ${
                    p.status === 'completed' ? 'bg-green' : p.status === 'in_progress' ? 'bg-amber' : 'bg-[var(--border)]'
                  }`}
                  style={{ left: `${p.pin_x * 100}%`, top: `${p.pin_y * 100}%` }}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Room grid */}
      {rooms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-primary mb-3">{t(locale, 'client.overview.rooms')}</h2>
          <Card>
            <div className="flex items-center gap-4 mb-4 text-xs text-secondary">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green" /> {t(locale, 'client.overview.done')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" /> {t(locale, 'client.overview.inProgress')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tertiary/30" /> {t(locale, 'client.overview.notStarted')}</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {rooms.map(r => (
                <div key={r.id} className="flex flex-col items-center gap-1 py-1.5 rounded-button bg-surface-elevated">
                  <span className={`w-2 h-2 rounded-full ${roomDotColor(r.id, roomTasks)}`} />
                  <span className="text-xs font-medium text-primary">{r.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Recent photos */}
      {recentPhotos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-primary mb-3">{t(locale, 'client.overview.recentPhotos')}</h2>
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
        {t(locale, 'client.overview.footer')}
      </p>
    </div>
  )
}
