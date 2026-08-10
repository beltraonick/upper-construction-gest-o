import { getCurrentUser, getImpersonatorToken } from '@/lib/auth/session'
import { ImpersonationBannerClient } from './ImpersonationBannerClient'

// Shown on every page while an owner is impersonating another account
// (see app/actions/owner.ts). Server-only because the impersonator
// cookie is httpOnly and can't be read from the client.
export function ImpersonationBanner() {
  if (!getImpersonatorToken()) return null
  const user = getCurrentUser()
  if (!user) return null
  return <ImpersonationBannerClient name={user.full_name} />
}
