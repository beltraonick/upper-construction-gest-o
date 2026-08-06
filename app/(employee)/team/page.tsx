import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type EmployeePermissions } from '@/lib/permissions'
import { t } from '@/lib/i18n/translate'

const supabaseReady =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-tertiary flex-shrink-0">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  )
}

export default async function TeamHubPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const locale = user.language

  let permissions: EmployeePermissions = {}
  if (supabaseReady) {
    try {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('permissions')
        .eq('email', user.email)
        .eq('company_id', user.company_id)
        .maybeSingle()
      permissions = (profile?.permissions as EmployeePermissions | null) ?? {}
    } catch {
      // silent
    }
  }

  const links = [
    hasPermission(permissions, 'checkin_team') && {
      href: '/team/checkin',
      title: t(locale, 'employee.team.checkinTitle'),
      subtitle: t(locale, 'employee.team.checkinSubtitle'),
    },
    hasPermission(permissions, 'create_extras') && {
      href: '/team/extras',
      title: t(locale, 'employee.team.extrasTitle'),
      subtitle: t(locale, 'employee.team.extrasSubtitle'),
    },
    hasPermission(permissions, 'close_payroll') && {
      href: '/team/payroll',
      title: t(locale, 'employee.team.payrollTitle'),
      subtitle: t(locale, 'employee.team.payrollSubtitle'),
    },
  ].filter(Boolean) as { href: string; title: string; subtitle: string }[]

  if (links.length === 0) redirect('/home')

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary tracking-tight">{t(locale, 'employee.team.title')}</h1>
        <p className="text-sm text-secondary mt-0.5">{t(locale, 'employee.team.subtitle')}</p>
      </div>

      <div className="space-y-3">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 bg-surface rounded-card border border-[var(--border)] shadow-sm px-5 py-4 hover:border-brand/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">{link.title}</p>
              <p className="text-xs text-secondary mt-0.5">{link.subtitle}</p>
            </div>
            <ChevronIcon />
          </Link>
        ))}
      </div>
    </div>
  )
}
