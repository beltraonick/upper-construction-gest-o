import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  // Find all completed, not-synced entries for this company
  const { data: entries } = await supabase
    .from('time_entries')
    .select('id')
    .eq('company_id', user.company_id)
    .eq('qbo_sync_status', 'not_synced')
    .not('clock_out', 'is', null)
    .order('clock_out', { ascending: true })
    .limit(100)

  if (!entries?.length) {
    return NextResponse.json({ ok: true, synced: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let synced = 0
  let failed = 0

  for (const entry of entries) {
    try {
      const res = await fetch(`${appUrl}/api/qbo/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_entry_id: entry.id }),
      })
      const data = await res.json()
      if (data.ok && !data.skipped) synced++
      else if (!data.ok) failed++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ ok: true, total: entries.length, synced, failed })
}
