import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { t } from '@/lib/i18n/translate'
import Link from 'next/link'
import { EmployeeTaskList } from './EmployeeTaskList'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

function coverUrl(path: string | null) {
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/project-photos/${path}`
}

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function EmployeeProjectDetailPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const locale = user.language
  const projectId = params.id

  type TaskRow = {
    id: string
    title: string
    status: string
    area: string | null
    due_date: string | null
    checklist: { text: string; done: boolean }[]
    notes: string | null
  }

  let projectName = ''
  let projectProgress = 0
  let projectAddress: string | null = null
  let coverPath: string | null = null
  let tasks: TaskRow[] = []
  let found = false

  if (supabaseReady) {
    try {
      const supabase = createClient()

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .eq('company_id', user.company_id)
        .maybeSingle()

      if (profile) {
        const { data: member } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('profile_id', profile.id)
          .eq('project_id', projectId)
          .maybeSingle()

        if (member) {
          found = true

          const { data: proj } = await supabase
            .from('projects')
            .select('name, status, progress, address, cover_image_path')
            .eq('id', projectId)
            .maybeSingle()

          if (proj) {
            projectName = proj.name
            projectProgress = proj.progress ?? 0
            projectAddress = proj.address ?? null
            coverPath = proj.cover_image_path ?? null
          }

          const { data: assignments } = await supabase
            .from('task_assignments')
            .select('task_id')
            .eq('profile_id', profile.id)

          const assignedIds = (assignments ?? []).map((a: { task_id: string }) => a.task_id)

          if (assignedIds.length > 0) {
            const { data: taskRows } = await supabase
              .from('tasks')
              .select('id, title, status, area, due_date, checklist, notes')
              .eq('project_id', projectId)
              .in('id', assignedIds)
              .order('created_at', { ascending: false })
            tasks = (taskRows ?? []) as TaskRow[]
          }
        }
      }
    } catch {
      // silent
    }
  }

  if (!found) redirect('/projects')

  const cover = coverUrl(coverPath)

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Cover */}
      {cover && (
        <div className="h-44 w-full overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={projectName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="px-4 max-w-lg mx-auto">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-secondary mt-5 mb-4 hover:text-primary transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {t(locale, 'employee.projects.back')}
        </Link>

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-primary tracking-tight">{projectName}</h1>
          {projectAddress && (
            <p className="text-sm text-secondary mt-0.5">{projectAddress}</p>
          )}
        </div>

        {/* Progress */}
        <div className="bg-surface rounded-[14px] border border-[var(--border)] p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-secondary">
              {t(locale, 'employee.projects.progress').replace('{n}', String(projectProgress))}
            </span>
            <span className="text-sm font-bold text-primary">{projectProgress}%</span>
          </div>
          <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${projectProgress}%`,
                background: projectProgress >= 100
                  ? 'rgb(var(--color-green))'
                  : 'rgb(var(--color-brand))',
              }}
            />
          </div>
        </div>

        {/* Tasks — interactive client component */}
        <h2 className="text-sm font-semibold text-primary mb-3">
          {t(locale, 'employee.projects.myTasks')}
        </h2>

        <EmployeeTaskList
          initialTasks={tasks}
          locale={locale}
          projectId={projectId}
        />
      </div>
    </div>
  )
}
