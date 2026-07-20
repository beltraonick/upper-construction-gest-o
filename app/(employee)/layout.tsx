import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { EmployeeNav } from './EmployeeNav'
import { CompanyProvider } from '@/lib/company-context'
import { OfflineBanner } from '@/components/OfflineBanner'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role === 'admin') redirect('/admin/dashboard')
  if (user.role === 'client') redirect('/client')

  return (
    <CompanyProvider companyId={user.company_id}>
      <div className="min-h-screen bg-background pb-20">
        <OfflineBanner />
        {children}
        <EmployeeNav />
      </div>
    </CompanyProvider>
  )
}
