import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'

export default function RootPage() {
  const user = getCurrentUser()

  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')
  if (user.role === 'admin') redirect('/admin/dashboard')
  if (user.role === 'client') redirect('/client')
  redirect('/home')
}
