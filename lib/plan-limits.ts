import type { SupabaseClient } from '@supabase/supabase-js'

interface LimitResult {
  allowed: boolean
  limit: number | null // null = unlimited
}

async function getPlanLimits(supabase: SupabaseClient, companyId: string) {
  const { data: company } = await supabase
    .from('companies')
    .select('plan_id')
    .eq('id', companyId)
    .maybeSingle()

  // No plan assigned yet — don't block anyone until billing is actually wired up.
  if (!company?.plan_id) return null

  const { data: plan } = await supabase
    .from('plans')
    .select('project_limit, admin_limit, employee_limit')
    .eq('id', company.plan_id)
    .maybeSingle()

  return plan
}

export async function checkProjectLimit(supabase: SupabaseClient, companyId: string): Promise<LimitResult> {
  const plan = await getPlanLimits(supabase, companyId)
  const limit = plan?.project_limit ?? null
  if (limit == null) return { allowed: true, limit: null }

  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  return { allowed: (count ?? 0) < limit, limit }
}

export async function checkRoleLimit(
  supabase: SupabaseClient,
  companyId: string,
  role: 'admin' | 'employee'
): Promise<LimitResult> {
  const plan = await getPlanLimits(supabase, companyId)
  const limit = role === 'admin' ? (plan?.admin_limit ?? null) : (plan?.employee_limit ?? null)
  if (limit == null) return { allowed: true, limit: null }

  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', role)

  return { allowed: (count ?? 0) < limit, limit }
}
