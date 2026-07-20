'use server'

import { redirect } from 'next/navigation'
import { findUserByEmail, createUser, toSessionUser } from '@/lib/auth/store'
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

  if (!verifyPassword(password, user.password_hash)) {
    return { error: 'Invalid email or password.' }
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
}): Promise<{ error?: string; success?: boolean }> {

  if (!data.email?.trim() || !data.full_name?.trim() || !data.password) {
    return { error: 'Please fill in all required fields.' }
  }

  if (data.password !== data.confirm_password) {
    return { error: 'Passwords do not match.' }
  }

  if (data.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const existing = await findUserByEmail(data.email.trim())
  if (existing) {
    return { error: 'An account with this email already exists.' }
  }

  await createUser({
    email: data.email.trim(),
    full_name: data.full_name.trim(),
    phone: data.phone?.trim() || null,
    password_hash: hashPassword(data.password),
    language: data.language,
  })

  return { success: true }
}

export async function logout(): Promise<void> {
  clearSessionCookie()
  redirect('/login')
}
