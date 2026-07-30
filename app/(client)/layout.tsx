import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { logout } from '@/app/actions/auth'
import { LocaleProvider } from '@/lib/i18n/LocaleContext'
import { t } from '@/lib/i18n/translate'
import { ClientNav } from './ClientNav'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role !== 'client') {
    if (user.role === 'admin') redirect('/admin/dashboard')
    if (user.role === 'owner') redirect('/owner/dashboard')
    redirect('/home')
  }

  return (
    <LocaleProvider locale={user.language}>
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface border-b border-[var(--border)] flex items-center justify-between px-4 h-14 safe-top">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="OrbitOps" className="w-7 h-7 rounded-lg object-cover" />
          <div>
            <p className="text-sm font-semibold text-primary leading-tight">OrbitOps</p>
            <p className="text-[10px] text-tertiary leading-tight">{t(user.language, 'client.portalLabel')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profile" className="text-right hidden sm:block hover:opacity-80 transition-opacity">
            <p className="text-xs font-medium text-primary leading-tight">{user.full_name}</p>
            <p className="text-[10px] text-tertiary">{t(user.language, 'common.role.client')}</p>
          </Link>
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              className="p-2 rounded-button text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
              title="Sign out"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
        </div>
      </header>

      <div className="pt-14 sticky top-14 z-30">
        <ClientNav />
      </div>

      <main className="pb-8 min-h-screen">
        {children}
      </main>
    </div>
    </LocaleProvider>
  )
}
