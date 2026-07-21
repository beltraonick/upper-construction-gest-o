'use server'

import { redirect } from 'next/navigation'
import { findUserByEmail, createEmployeeWithInvite, findActiveInviteCode, toSessionUser } from '@/lib/auth/store'
import { verifyPassword, hashPassword } from '@/lib/auth/crypto'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth/session'
import type { Language, UserRole, UserStatus } from '@/lib/auth/types'

export async function login(
  email: string,
  password: string
): Promise<{ error?: string; role?: UserRole; status?: UserStatus }> {

  if (!email?.trim() || !password) {
    return { error: 'Email and password are required.' }
  }

  const user = await findUserByEmail(email.trim())

  if (!user) {
    return { error: 'Invalid email or password.' }
  }

  // Account exists but has no password — client not yet activated.
  if (!user.password_hash) {
    return { error: 'Your account has not been activated yet. Use the activation link sent by your administrator.' }
  }

  if (!verifyPassword(password, user.password_hash)) {
    return { error: 'Invalid email or password.' }
  }

  if (user.status === 'suspended') {
    return { error: 'Your account has been suspended. Contact your administrator.' }
  }

  setSessionCookie(toSessionUser(user))

  return { role: user.role, status: user.status }
}

export async function register(data: {
  email: string
  full_name: string
  phone: string | null
  password: string
  confirm_password: string
  language: Language
  invite_code: string
}): Promise<{ error?: string; success?: boolean }> {

  if (!data.email?.trim() || !data.full_name?.trim() || !data.password) {
    return { error: 'Please fill in all required fields.' }
  }

  if (!data.invite_code?.trim()) {
    return { error: 'An invite code is required to register.' }
  }

  if (data.password !== data.confirm_password) {
    return { error: 'Passwords do not match.' }
  }

  if (data.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  // Validate invite code
  const invite = await findActiveInviteCode(data.invite_code.trim())
  if (!invite) {
    return { error: 'Invalid or expired invite code. Please ask your administrator for a valid code.' }
  }

  const existing = await findUserByEmail(data.email.trim())
  if (existing) {
    return { error: 'An account with this email already exists.' }
  }

  await createEmployeeWithInvite(
    {
      email: data.email.trim(),
      full_name: data.full_name.trim(),
      phone: data.phone?.trim() || null,
      password_hash: hashPassword(data.password),
      language: data.language,
    },
    invite.company_id,
    invite.id
  )

  return { success: true }
}

export async function logout(): Promise<void> {
  clearSessionCookie()
  redirect('/login')
}
