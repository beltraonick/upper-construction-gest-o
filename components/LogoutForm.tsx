'use client'

import { logout } from '@/app/actions/auth'
import { clearRememberToken } from '@/lib/auth/remember'

// Drop-in replacement for <form action={logout}>: also clears the
// localStorage session backup (lib/auth/remember.ts) so an explicit
// logout doesn't get silently undone by the auto-restore on next launch.
export function LogoutForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form action={logout} onSubmit={() => clearRememberToken()} className={className}>
      {children}
    </form>
  )
}
