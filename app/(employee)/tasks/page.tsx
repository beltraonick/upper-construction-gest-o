import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskList } from './TaskList'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function EmployeeTasksPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  let profileId: string | null = null
  let tasks: {
    id: string
    title: string
    description: string | null
    area: string | null
    priority: string
    status: string
    due_date: string | null
    checklist: { text: string; done: boolean }[]
    notes: string | null
    project: { name: string } | null
  }[] = []

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
            company_id: COMPANY_ID,
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
        const { data: t } = await supabase
          .from('tasks')
          .select('id, title, description, area, priority, status, due_date, checklist, notes, project:project_id(name)')
          .eq('company_id', COMPANY_ID)
          .or(`assigned_employee_id.eq.${profile.id},assigned_employee_id.is.null`)
          .neq('status', 'completed')
          .order('created_at', { ascending: false })

        tasks = (t ?? []) as unknown as typeof tasks
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary tracking-tight">My Tasks</h1>
        <p className="text-sm text-secondary mt-0.5">
          {tasks.length === 0 ? 'No tasks assigned' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} to do`}
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
