import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { profile_id, qbo_employee_id, qbo_employee_name } = body as {
    profile_id: string
    qbo_employee_id: string
    qbo_employee_name: string
  }

  if (!profile_id || !qbo_employee_id) {
    return NextResponse.json({ error: 'profile_id and qbo_employee_id are required' }, { status: 400 })
  }

  const supabase = createClient()
  const { error } = await supabase.from('qbo_employee_map').upsert(
    {
      company_id: user.company_id,
      profile_id,
      qbo_employee_id,
      qbo_employee_name: qbo_employee_name ?? null,
      mapped_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,profile_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { profile_id } = await req.json()
  if (!profile_id) {
    return NextResponse.json({ error: 'profile_id required' }, { status: 400 })
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('qbo_employee_map')
    .delete()
    .eq('company_id', user.company_id)
    .eq('profile_id', profile_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
