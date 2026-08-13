import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { fetchQBOEmployees, getValidAccessToken } from '@/lib/qbo/client'
import type { QBOConnection } from '@/lib/qbo/types'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  const { data: conn, error: connErr } = await supabase
    .from('qbo_connections')
    .select('*')
    .eq('company_id', user.company_id)
    .eq('is_active', true)
    .single()

  if (connErr || !conn) {
    return NextResponse.json({ error: 'Not connected to QuickBooks' }, { status: 400 })
  }

  const [qboEmployeesResult, profilesResult, mappingsResult] = await Promise.all([
    (async () => {
      try {
        const token = await getValidAccessToken(conn as QBOConnection)
        return fetchQBOEmployees(token, conn.realm_id)
      } catch (e) {
        throw e
      }
    })(),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('company_id', user.company_id)
      .eq('role', 'employee')
      .order('full_name'),
    supabase
      .from('qbo_employee_map')
      .select('profile_id, qbo_employee_id, qbo_employee_name')
      .eq('company_id', user.company_id),
  ])

  return NextResponse.json({
    qboEmployees: qboEmployeesResult,
    profiles: profilesResult.data ?? [],
    mappings: mappingsResult.data ?? [],
  })
}
