import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from './crypto'
import type { QBOEmployee, QBOTimeActivityPayload, QBOConnection } from './types'

const QBO_AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2'
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_SCOPE = 'com.intuit.quickbooks.accounting'

function getBaseUrl() {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

function getRedirectUri() {
  return (
    process.env.QUICKBOOKS_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/qbo/callback`
  )
}

function basicAuth() {
  const id = process.env.QUICKBOOKS_CLIENT_ID
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!id || !secret) throw new Error('QUICKBOOKS_CLIENT_ID or QUICKBOOKS_CLIENT_SECRET not set')
  return Buffer.from(`${id}:${secret}`).toString('base64')
}

export function buildAuthUrl(state: string): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID
  if (!id) throw new Error('QUICKBOOKS_CLIENT_ID not set')
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: QBO_SCOPE,
    state,
  })
  return `${QBO_AUTH_BASE}?${params}`
}

export async function exchangeCode(code: string) {
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth()}`,
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO code exchange failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
    token_type: string
  }>
}

async function doRefresh(refreshToken: string) {
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth()}`,
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO token refresh failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

/** Decrypt stored tokens and auto-refresh if expiry is within 5 minutes. */
export async function getValidAccessToken(conn: QBOConnection): Promise<string> {
  const accessToken = decryptToken(conn.access_token_enc)
  const expiresAt = new Date(conn.token_expires_at).getTime()
  const fiveMin = 5 * 60 * 1000

  if (Date.now() < expiresAt - fiveMin) {
    return accessToken
  }

  // Refresh
  const refreshToken = decryptToken(conn.refresh_token_enc)
  const tokens = await doRefresh(refreshToken)
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const supabase = createClient()
  await supabase
    .from('qbo_connections')
    .update({
      access_token_enc: encryptToken(tokens.access_token),
      refresh_token_enc: encryptToken(tokens.refresh_token),
      token_expires_at: newExpiry,
    })
    .eq('id', conn.id)

  return tokens.access_token
}

export async function fetchQBOEmployees(
  accessToken: string,
  realmId: string
): Promise<QBOEmployee[]> {
  const url = `${getBaseUrl()}/v3/company/${realmId}/query?query=select%20*%20from%20Employee%20where%20Active%3Dtrue%20MAXRESULTS%20200&minorversion=65`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO employees fetch failed ${res.status}: ${text}`)
  }
  const data = await res.json()
  return (data.QueryResponse?.Employee ?? []) as QBOEmployee[]
}

export async function createTimeActivity(
  accessToken: string,
  realmId: string,
  payload: QBOTimeActivityPayload
): Promise<string> {
  const url = `${getBaseUrl()}/v3/company/${realmId}/timeactivity?minorversion=65`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO TimeActivity create failed ${res.status}: ${text}`)
  }
  const data = await res.json()
  const activityId = data.TimeActivity?.Id as string | undefined
  if (!activityId) throw new Error('QBO returned no TimeActivity Id')
  return activityId
}

/** Store tokens encrypted after a successful OAuth exchange. */
export async function saveConnection({
  companyId,
  connectedBy,
  realmId,
  accessToken,
  refreshToken,
  expiresIn,
}: {
  companyId: string
  connectedBy: string
  realmId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}) {
  const supabase = createClient()
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  const { error } = await supabase.from('qbo_connections').upsert(
    {
      company_id: companyId,
      realm_id: realmId,
      access_token_enc: encryptToken(accessToken),
      refresh_token_enc: encryptToken(refreshToken),
      token_expires_at: expiresAt,
      connected_by: connectedBy,
      is_active: true,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' }
  )
  if (error) throw error
}
