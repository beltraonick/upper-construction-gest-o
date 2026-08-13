import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth/session'
import { buildAuthUrl } from '@/lib/qbo/client'
import { randomBytes } from 'crypto'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin' || !user.company_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Generate a random state token for CSRF protection, store in a short-lived cookie.
  const state = randomBytes(24).toString('hex')

  const cookieStore = cookies()
  cookieStore.set('qbo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Also stash company_id so the callback knows which company to bind to.
  cookieStore.set('qbo_oauth_company', user.company_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  cookieStore.set('qbo_oauth_user', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const authUrl = buildAuthUrl(state)
  return NextResponse.redirect(authUrl)
}
