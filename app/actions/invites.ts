'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { generateInviteCode } from '@/lib/auth/crypto'

export async function getCompanyInviteCode(): Promise<{ code?: string; error?: string }> {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return { error: 'Not authorized.' }
  }

  const supabase = createClient()
  const { data } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('company_id', user.company_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    // No active code — generate one on the fly.
    return regenerateInviteCode()
  }

  return { code: data.code }
}

export async function regenerateInviteCode(): Promise<{ code?: string; error?: string }> {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return { error: 'Not authorized.' }
  }

  const supabase = createClient()
  const company_id = user.company_id

  // Deactivate all existing codes for this company.
  await supabase
    .from('invite_codes')
    .update({ is_active: false })
    .eq('company_id', company_id)
    .eq('is_active', true)

  // Insert new code (retry on collision).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode()
    const { error } = await supabase.from('invite_codes').insert({
      company_id,
      code,
      created_by: user.id,
      is_active: true,
    })
    if (!error) return { code }
  }

  return { error: 'Could not generate an invite code. Please try again.' }
}
