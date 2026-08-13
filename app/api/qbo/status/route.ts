import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  const { data: conn } = await supabase
    .from('qbo_connections')
    .select('id, realm_id, connected_at, is_active')
    .eq('company_id', user.company_id)
    .single()

  if (!conn) {
    return NextResponse.json({ connected: false })
  }

  // Sync stats: last 50 log entries
  const { data: logs } = await supabase
    .from('qbo_sync_log')
    .select('status, attempted_at, error_message, synced_at')
    .eq('company_id', user.company_id)
    .order('attempted_at', { ascending: false })
    .limit(50)

  const total = logs?.length ?? 0
  const success = logs?.filter((l: { status: string }) => l.status === 'success').length ?? 0
  const failed = logs?.filter((l: { status: string }) => l.status === 'failed').length ?? 0
  const lastSync = logs?.[0]?.synced_at ?? null

  // Pending (not_synced) count
  const { count: pendingCount } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', user.company_id)
    .eq('qbo_sync_status', 'not_synced')
    .not('clock_out', 'is', null)

  return NextResponse.json({
    connected: true,
    realmId: conn.realm_id,
    connectedAt: conn.connected_at,
    stats: { total, success, failed, lastSync, pending: pendingCount ?? 0 },
    recentLogs: logs?.slice(0, 10) ?? [],
  })
}
