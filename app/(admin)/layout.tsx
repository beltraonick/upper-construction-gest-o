import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { Sidebar } from '@/components/admin/Sidebar'
import { CompanyProvider } from '@/lib/company-context'
import { UserProvider } from '@/lib/user-context'
import { LocaleProvider } from '@/lib/i18n/LocaleContext'
import { OfflineBanner } from '@/components/OfflineBanner'
import { getPendingRequests } from '@/app/actions/membership'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role === 'client') redirect('/client')
  if (user.role === 'owner') redirect('/owner/dashboard')
  if (user.role !== 'admin') redirect('/home')

  const { requests } = await getPendingRequests()
  const pendingCount = requests?.length ?? 0

  return (
    // Every non-owner profile always has a company_id — owner is the
    // only role that isn't scoped to one, and it's redirected above.
    <LocaleProvider locale={user.language}>
      <CompanyProvider companyId={user.company_id as string}>
        <UserProvider user={{ id: user.id, name: user.full_name }}>
          <div className="flex h-screen bg-background overflow-hidden">
            <OfflineBanner />
            <Sidebar user={user} pendingCount={pendingCount} />
            {/* pt-14 = mobile topbar height; pb-20 = mobile bottom nav; md resets both */}
            <main className="flex-1 md:ml-[240px] overflow-y-auto pt-14 md:pt-0 pb-20 md:pb-0">
              {children}
            </main>
          </div>
        </UserProvider>
      </CompanyProvider>
    </LocaleProvider>
  )
}
