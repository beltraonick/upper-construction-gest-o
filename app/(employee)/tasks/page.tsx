import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskList } from './TaskList'
import { t } from '@/lib/i18n/translate'
import { hasPermission, type EmployeePermissions } from '@/lib/permissions'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function EmployeeTasksPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const locale = user.language

  let profileId: string | null = null
  let canDeleteTeamPhotos = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tasks: any[] = []

  if (supabaseReady) {
    try {
      const supabase = createClient()

      // Add company_id filter to prevent cross-company matches on shared emails
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, permissions')
        .eq('email', user.email)
        .eq('company_id', user.company_id)
        .maybeSingle()

      if (profile) {
        profileId = profile.id
        canDeleteTeamPhotos = hasPermission(profile.permissions as EmployeePermissions | null, 'delete_team_photos')

        // Query via task_assignments join table (migration 022)
        const { data: assignments } = await supabase
          .from('task_assignments')
          .select('task_id')
          .eq('profile_id', profileId)

        const assignedIds = (assignments ?? []).map((a: { task_id: string }) => a.task_id)

        if (assignedIds.length > 0) {
          const { data: t } = await supabase
            .from('tasks')
            .select('*, project:project_id(name)')
            .in('id', assignedIds)
            .neq('status', 'completed')
            .order('created_at', { ascending: false })
          tasks = t ?? []
        } else {
          // Fallback: if task_assignments table doesn't exist yet, use assigned_to column
          const { data: t } = await supabase
            .from('tasks')
            .select('*, project:project_id(name)')
            .eq('assigned_to', profileId)
            .neq('status', 'completed')
            .order('created_at', { ascending: false })
          tasks = t ?? []
        }
      }
    } catch {
      // silent
    }
  }

  const taskCount = tasks.length

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary tracking-tight">{t(locale, 'employee.tasks.title')}</h1>
        <p className="text-sm text-secondary mt-0.5">
          {taskCount === 0
            ? t(locale, 'employee.tasks.noTasksAssigned')
            : t(locale, taskCount === 1 ? 'employee.tasks.taskCountSingular' : 'employee.tasks.taskCountPlural').replace('{n}', String(taskCount))}
        </p>
      </div>

      <TaskList
        tasks={tasks}
        profileId={profileId}
        employeeName={user.full_name ?? ''}
        supabaseReady={!!supabaseReady}
        canDeleteTeamPhotos={canDeleteTeamPhotos}
      />
    </div>
  )
}
