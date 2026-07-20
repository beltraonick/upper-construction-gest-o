import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { Sidebar } from '@/components/admin/Sidebar'
import { OrbitAI } from '@/components/OrbitAI'
import { CompanyProvider } from '@/lib/company-context'
import { OfflineBanner } from '@/components/OfflineBanner'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role === 'client') redirect('/client')
  if (user.role !== 'admin') redirect('/home')

  return (
    <CompanyProvider companyId={user.company_id}>
      <div className="flex h-screen bg-background overflow-hidden">
        <OfflineBanner />
        <Sidebar user={user} />
        {/* pt-14 = mobile topbar height; pb-20 = mobile bottom nav; md resets both */}
        <main className="flex-1 md:ml-[240px] overflow-y-auto pt-14 md:pt-0 pb-20 md:pb-0">
          {children}
        </main>
        <OrbitAI />
      </div>
    </CompanyProvider>
  )
}
