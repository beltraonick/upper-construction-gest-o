import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type EmployeePermissions } from '@/lib/permissions'
import { PayrollManager } from '@/components/payroll/PayrollManager'

const supabaseReady =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function TeamPayrollPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('email', user.email)
        .eq('company_id', user.company_id)
        .maybeSingle()

      const permissions = (profile?.permissions as EmployeePermissions | null) ?? {}
      if (!profile || !hasPermission(permissions, 'close_payroll')) redirect('/team')
    } catch {
      redirect('/team')
    }
  } else {
    redirect('/team')
  }

  return <PayrollManager />
}
