'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { setSessionCookie } from '@/lib/auth/session'
import { hashPassword, verifyPassword } from '@/lib/auth/crypto'
import { toSessionUser } from '@/lib/auth/store'
import type { AuthUser, Language } from '@/lib/auth/types'

export async function getMyProfile() {
  const user = getCurrentUser()
  if (!user) return null

  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, avatar_url, language, email_notifications, role')
    .eq('id', user.id)
    .maybeSingle()

  return data
}

export async function updateProfile(data: {
  full_name: string
  phone: string | null
  avatar_url: string | null
  language: Language
  email_notifications: boolean
}): Promise<{ error?: string }> {
  const user = getCurrentUser()
  if (!user) return { error: 'Not authorized.' }
  if (!data.full_name.trim()) return { error: 'Name is required.' }

  const supabase = createClient()
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name.trim(),
      phone: data.phone || null,
      avatar_url: data.avatar_url || null,
      language: data.language,
      email_notifications: data.email_notifications,
    })
    .eq('id', user.id)
    .select('id, email, full_name, phone, role, auth_status, language, password_hash, company_id, created_at')
    .single()

  if (error || !updated) return { error: 'Could not save changes.' }

  // Refresh the session cookie so the new name/language show up immediately.
  const authUser: AuthUser = {
    id: updated.id,
    email: updated.email,
    full_name: updated.full_name,
    phone: updated.phone,
    role: updated.role,
    status: updated.auth_status,
    language: updated.language ?? data.language,
    password_hash: updated.password_hash ?? '',
    company_id: updated.company_id,
    created_at: updated.created_at,
  }
  setSessionCookie(toSessionUser(authUser))

  return {}
}

export async function changeMyPassword(data: {
  current_password: string
  new_password: string
  confirm_password: string
}): Promise<{ error?: string }> {
  const user = getCurrentUser()
  if (!user) return { error: 'Not authorized.' }

  if (data.new_password !== data.confirm_password) {
    return { error: 'New passwords do not match.' }
  }
  if (data.new_password.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }

  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_hash')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.password_hash || !verifyPassword(data.current_password, profile.password_hash)) {
    return { error: 'Current password is incorrect.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ password_hash: hashPassword(data.new_password) })
    .eq('id', user.id)

  if (error) return { error: 'Could not change password.' }
  return {}
}
