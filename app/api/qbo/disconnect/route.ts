import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('qbo_connections')
    .delete()
    .eq('company_id', user.company_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
