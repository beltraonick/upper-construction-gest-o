import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role === 'admin') redirect('/admin/dashboard')

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
