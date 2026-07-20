'use server'

import { createClient } from '@/lib/supabase/server'
import { hashPassword } from '@/lib/auth/crypto'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

export async function createProfileWithPassword(data: {
  full_name: string
  email: string
  role: string
  position: string | null
  company_name: string | null
  hourly_rate: number
  phone: string | null
  password: string
}): Promise<{ error?: string }> {
  if (!data.full_name.trim() || !data.email.trim()) {
    return { error: 'Name and email are required.' }
  }
  if (!data.password || data.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('profiles').insert({
    company_id: COMPANY_ID,
    full_name: data.full_name.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
    position: data.position || null,
    company_name: data.company_name || null,
    hourly_rate: data.hourly_rate,
    phone: data.phone || null,
    status: 'active',
    auth_status: 'approved',
    password_hash: hashPassword(data.password),
  })

  if (error) return { error: error.message }
  return {}
}
