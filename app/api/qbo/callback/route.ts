import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCode, saveConnection } from '@/lib/qbo/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const errorParam = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const settingsUrl = `${appUrl}/admin/settings`

  if (errorParam) {
    return NextResponse.redirect(`${settingsUrl}?qbo=error&reason=${encodeURIComponent(errorParam)}`)
  }

  if (!code || !state || !realmId) {
    return NextResponse.redirect(`${settingsUrl}?qbo=error&reason=missing_params`)
  }

  const cookieStore = cookies()
  const storedState = cookieStore.get('qbo_oauth_state')?.value
  const companyId = cookieStore.get('qbo_oauth_company')?.value
  const userId = cookieStore.get('qbo_oauth_user')?.value

  // Clear state cookies immediately
  cookieStore.delete('qbo_oauth_state')
  cookieStore.delete('qbo_oauth_company')
  cookieStore.delete('qbo_oauth_user')

  if (!storedState || storedState !== state || !companyId || !userId) {
    return NextResponse.redirect(`${settingsUrl}?qbo=error&reason=invalid_state`)
  }

  try {
    const tokens = await exchangeCode(code)
    await saveConnection({
      companyId,
      connectedBy: userId,
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    })
    return NextResponse.redirect(`${settingsUrl}?qbo=connected`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[QBO callback]', msg)
    return NextResponse.redirect(`${settingsUrl}?qbo=error&reason=${encodeURIComponent(msg)}`)
  }
}
