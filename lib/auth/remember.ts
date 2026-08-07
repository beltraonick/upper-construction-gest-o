// Client-side backup of the session token, used to silently restore login
// if the httpOnly cookie goes missing (notably: iOS can wipe cookies for
// home-screen-installed apps when fully closed and reopened). Wrapped in
// try/catch since localStorage can throw in some privacy modes.

const REMEMBER_KEY = 'uc_remember_token'

export function saveRememberToken(token: string) {
  try { localStorage.setItem(REMEMBER_KEY, token) } catch { /* ignore */ }
}

export function getRememberToken(): string | null {
  try { return localStorage.getItem(REMEMBER_KEY) } catch { return null }
}

export function clearRememberToken() {
  try { localStorage.removeItem(REMEMBER_KEY) } catch { /* ignore */ }
}

export function roleRedirectPath(role?: string, status?: string): string {
  if (status === 'pending') return '/pending'
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'client') return '/client'
  if (role === 'owner') return '/owner/dashboard'
  return '/home'
}
