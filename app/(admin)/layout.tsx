import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { Sidebar } from '@/components/admin/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role !== 'admin') redirect('/employee/dashboard')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 ml-[240px] overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
