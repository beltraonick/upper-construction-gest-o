import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskList } from './TaskList'
import { t } from '@/lib/i18n/translate'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function EmployeeTasksPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const locale = user.language

  let profileId: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tasks: any[] = []

  if (supabaseReady) {
    try {
      const supabase = createClient()

      let { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (!profile) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            company_id: user.company_id,
            role: user.role,
            full_name: user.full_name,
            email: user.email,
            status: 'active',
          })
          .select('id')
          .single()
        profile = newProfile
      }

      if (profile) {
        profileId = profile.id

        // Use select('*') so it works with both pre- and post-migration schema.
        // After migration 003, the extra columns (priority, area, checklist, notes…)
        // appear automatically. The assigned_to column is the pre-migration FK;
        // assigned_employee_id is added by migration 003.
        const orFilter = profile
          ? `assigned_to.eq.${profile.id},assigned_to.is.null`
          : `assigned_to.is.null`

        const { data: t } = await supabase
          .from('tasks')
          .select('*, project:project_id(name)')
          .or(orFilter)
          .neq('status', 'completed')
          .order('created_at', { ascending: false })

        tasks = t ?? []
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
        supabaseReady={!!supabaseReady}
      />
    </div>
  )
}
