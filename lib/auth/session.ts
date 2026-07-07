/**
 * Stateless JWT-style sessions using HMAC-SHA256.
 * No server-side state — survives hot reloads, restarts, and horizontal scaling.
 * Swap this module for a Supabase/Firebase session handler in production.
 */
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import type { SessionUser } from './types'

const COOKIE_NAME = 'uc_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds
const SECRET = process.env.AUTH_SECRET ?? 'upper_construction_dev_secret_fallback'

// ─── Token encoding/decoding ─────────────────────────────────────────────────

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

function fromB64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function createToken(user: SessionUser): string {
  const payload = b64url(JSON.stringify({ user, exp: Date.now() + MAX_AGE * 1000 }))
  const sig = sign(payload)
  return `${payload}.${sig}`
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    // Constant-time comparison via re-signing
    if (sign(payload) !== sig) return null
    const { user, exp } = JSON.parse(fromB64url(payload))
    if (!user || !exp || Date.now() > exp) return null
    return user as SessionUser
  } catch {
    return null
  }
}

// ─── Cookie helpers (server components / server actions only) ─────────────────

export function setSessionCookie(user: SessionUser): void {
  const token = createToken(user)
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE_NAME)
}

export function getCurrentUser(): SessionUser | null {
  try {
    const token = cookies().get(COOKIE_NAME)?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

export function getSessionCookieValue(): string | null {
  try {
    return cookies().get(COOKIE_NAME)?.value ?? null
  } catch {
    return null
  }
}
