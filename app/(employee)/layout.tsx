import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { EmployeeNav } from './EmployeeNav'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role === 'admin') redirect('/admin/dashboard')
  if (user.role === 'client') redirect('/client')

  return (
    <div className="min-h-screen bg-background pb-20">
      {children}
      <EmployeeNav />
    </div>
  )
}
