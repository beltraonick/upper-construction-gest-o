import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidAccessToken, createTimeActivity } from '@/lib/qbo/client'
import type { QBOConnection, QBOTimeActivityPayload } from '@/lib/qbo/types'

function toHoursMinutes(clockIn: string, clockOut: string) {
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  const totalMinutes = Math.round(diffMs / 60000)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

function toQBODate(iso: string) {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function toQBOTime(iso: string) {
  // QBO expects hh:mm:ssZ
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}:00Z`
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { time_entry_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { time_entry_id } = body

  if (!time_entry_id) {
    return NextResponse.json({ error: 'time_entry_id required' }, { status: 400 })
  }

  const supabase = createClient()

  // Fetch the time entry
  const { data: entry, error: entryErr } = await supabase
    .from('time_entries')
    .select('id, company_id, employee_id, clock_in, clock_out, qbo_sync_status')
    .eq('id', time_entry_id)
    .single()

  if (entryErr || !entry) {
    return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
  }

  // Ensure the entry belongs to the caller's company
  if (entry.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!entry.clock_out) {
    return NextResponse.json({ error: 'Clock out not yet recorded', skipped: true }, { status: 200 })
  }

  // Skip already synced
  if (entry.qbo_sync_status === 'synced') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_synced' })
  }

  const companyId = entry.company_id as string

  // Fetch QBO connection
  const { data: conn } = await supabase
    .from('qbo_connections')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single()

  if (!conn) {
    // No QBO connection — mark as skipped
    await supabase
      .from('time_entries')
      .update({ qbo_sync_status: 'skipped' })
      .eq('id', time_entry_id)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_connection' })
  }

  // Fetch employee mapping
  const { data: mapping } = await supabase
    .from('qbo_employee_map')
    .select('qbo_employee_id, qbo_employee_name')
    .eq('company_id', companyId)
    .eq('profile_id', entry.employee_id)
    .single()

  if (!mapping) {
    await supabase
      .from('qbo_sync_log')
      .insert({
        company_id: companyId,
        time_entry_id,
        status: 'skipped',
        error_message: 'Employee not mapped to QBO',
      })
    await supabase
      .from('time_entries')
      .update({ qbo_sync_status: 'skipped' })
      .eq('id', time_entry_id)
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_mapping' })
  }

  // Get valid access token (auto-refresh if needed)
  let accessToken: string
  try {
    accessToken = await getValidAccessToken(conn as QBOConnection)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token refresh failed'
    await supabase.from('qbo_sync_log').insert({
      company_id: companyId,
      time_entry_id,
      status: 'failed',
      error_message: msg,
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Build TimeActivity payload
  const { hours, minutes } = toHoursMinutes(entry.clock_in, entry.clock_out)
  const payload: QBOTimeActivityPayload = {
    NameOf: 'Employee',
    EmployeeRef: {
      value: mapping.qbo_employee_id,
      name: mapping.qbo_employee_name ?? undefined,
    },
    TxnDate: toQBODate(entry.clock_in),
    StartTime: toQBOTime(entry.clock_in),
    EndTime: toQBOTime(entry.clock_out),
    Hours: hours,
    Minutes: minutes,
    BillableStatus: 'NotBillable',
    Description: `Synced from OrbitOps — entry ${time_entry_id.slice(0, 8)}`,
  }

  try {
    const activityId = await createTimeActivity(accessToken, conn.realm_id, payload)

    await Promise.all([
      supabase
        .from('time_entries')
        .update({ qbo_sync_status: 'synced', qbo_time_activity_id: activityId })
        .eq('id', time_entry_id),
      supabase.from('qbo_sync_log').insert({
        company_id: companyId,
        time_entry_id,
        qbo_time_activity_id: activityId,
        status: 'success',
        synced_at: new Date().toISOString(),
      }),
    ])

    return NextResponse.json({ ok: true, qboId: activityId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown QBO error'
    await Promise.all([
      supabase
        .from('time_entries')
        .update({ qbo_sync_status: 'failed' })
        .eq('id', time_entry_id),
      supabase.from('qbo_sync_log').insert({
        company_id: companyId,
        time_entry_id,
        status: 'failed',
        error_message: msg,
      }),
    ])
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
