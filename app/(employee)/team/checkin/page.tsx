import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type EmployeePermissions } from '@/lib/permissions'
import { t } from '@/lib/i18n/translate'
import { TeamCheckin, type TeamMember } from './TeamCheckin'

const supabaseReady =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function TeamCheckinPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const locale = user.language
  let supervisorId: string | null = null
  let members: TeamMember[] = []

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, permissions')
        .eq('email', user.email)
        .eq('company_id', user.company_id)
        .maybeSingle()

      const permissions = (profile?.permissions as EmployeePermissions | null) ?? {}
      if (!profile || !hasPermission(permissions, 'checkin_team')) redirect('/team')
      supervisorId = profile.id

      const [{ data: employees }, { data: openEntries }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, position')
          .eq('company_id', user.company_id)
          .eq('role', 'employee')
          .eq('status', 'active')
          .neq('id', supervisorId)
          .order('full_name'),
        supabase
          .from('time_entries')
          .select('id, employee_id, clock_in')
          .eq('company_id', user.company_id)
          .is('clock_out', null),
      ])

      const openByEmployee = new Map((openEntries ?? []).map(e => [e.employee_id, e]))

      members = (employees ?? []).map(e => {
        const open = openByEmployee.get(e.id)
        return {
          id: e.id,
          full_name: e.full_name,
          position: e.position,
          openEntryId: open?.id ?? null,
          clockInTime: open?.clock_in ?? null,
        }
      })
    } catch {
      // silent
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary tracking-tight">{t(locale, 'employee.team.checkinTitle')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t(locale, 'employee.team.checkinPageSubtitle')}</p>
      </div>

      <TeamCheckin
        members={members}
        supervisorId={supervisorId}
        companyId={user.company_id as string}
        supabaseReady={!!supabaseReady}
      />
    </div>
  )
}
