import { createClient } from '@/lib/supabase/server'

const THROTTLE_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Refreshes last_login_at and logs an access event — but only once per
 * ~30 minute window, so browsing around the app doesn't spam a new
 * "access" per page load. Called from the admin/employee/client layouts
 * on every request, which is what catches a long-lived session that
 * never goes through login()/restoreSession() again (otherwise an
 * account that logged in once, weeks ago, and just kept an open session
 * would show "Never" forever in the owner panel even while actively
 * using the app).
 */
export async function touchAccess(profileId: string, companyId: string | null): Promise<void> {
  try {
    const supabase = createClient()
    const cutoff = new Date(Date.now() - THROTTLE_MS).toISOString()
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('profiles')
      .update({ last_login_at: now })
      .eq('id', profileId)
      .or(`last_login_at.is.null,last_login_at.lt.${cutoff}`)
      .select('id')

    if (data && data.length > 0) {
      await supabase.from('login_events').insert({ profile_id: profileId, company_id: companyId })
    }
  } catch {
    // best-effort — never block a page render over this
  }
}
