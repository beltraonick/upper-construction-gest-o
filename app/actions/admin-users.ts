'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/crypto'
import { checkRoleLimit } from '@/lib/plan-limits'
import { generateClientActivation } from './client-activation'

export async function createProfileWithPassword(data: {
  full_name: string
  email: string
  role: string
  position: string | null
  company_name: string | null
  hourly_rate: number
  phone: string | null
  password: string
}): Promise<{ error?: string; activationUrl?: string }> {
  if (!data.full_name.trim() || !data.email.trim()) {
    return { error: 'Name and email are required.' }
  }

  const user = getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { error: 'Not authorized.' }
  }

  const supabase = createClient()

  // Client-role logins are unlimited on every plan — only admin/employee count.
  if (data.role === 'admin' || data.role === 'employee') {
    const { allowed, limit } = await checkRoleLimit(supabase, user.company_id as string, data.role)
    if (!allowed) {
      return { error: `Your plan allows up to ${limit} ${data.role === 'admin' ? 'admins' : 'employees'}. Upgrade to add more.` }
    }
  }

  if (data.role === 'client') {
    // Clients are created without a password; they activate via a one-time link.
    const { error, data: profile } = await supabase.from('profiles').insert({
      company_id: user.company_id,
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'client',
      position: data.position || null,
      company_name: data.company_name || null,
      hourly_rate: data.hourly_rate,
      phone: data.phone || null,
      status: 'active',
      auth_status: 'pending',
      // No password_hash — set when client activates their account.
    }).select('id').single()

    if (error) return { error: error.message }
    if (!profile) return { error: 'Could not create client profile.' }

    // Generate the activation link.
    const { activationUrl, error: activationErr } = await generateClientActivation(profile.id)
    if (activationErr) return { error: activationErr }

    return { activationUrl }
  }

  if (!data.password || data.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const { error } = await supabase.from('profiles').insert({
    company_id: user.company_id,
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
