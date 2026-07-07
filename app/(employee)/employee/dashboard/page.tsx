import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { logout } from '@/app/actions/auth'

export default function EmployeeDashboardPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'pending') redirect('/pending')

  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const supabaseReady =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

  return (
    <div className="max-w-lg mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={user.full_name} size="xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-secondary">{greeting},</p>
          <h1 className="text-2xl font-bold text-primary tracking-tight truncate">{user.full_name}</h1>
          <p className="text-sm text-secondary">Employee</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            className="p-2 rounded-button text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </div>

      {!supabaseReady && (
        <div className="mb-6 bg-amber/5 border border-amber/20 rounded-card px-5 py-4">
          <p className="text-xs font-semibold text-amber mb-0.5">Supabase not connected</p>
          <p className="text-xs text-secondary">Connect Supabase to enable clock in/out, tasks, and earnings.</p>
        </div>
      )}

      {/* Clock In/Out */}
      <Card className="mb-6">
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-sm text-secondary">You are not clocked in</p>
          <button
            disabled={!supabaseReady}
            className="inline-flex items-center justify-center gap-2 font-medium rounded-button bg-brand hover:bg-brand-hover text-white h-12 px-6 text-base w-full transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clock In
          </button>
        </div>
      </Card>

      {/* Week Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">Hours This Week</p>
          <p className="text-2xl font-bold text-primary">—</p>
        </Card>
        <Card>
          <p className="text-xs text-secondary uppercase tracking-wide mb-1">Earnings This Week</p>
          <p className="text-2xl font-bold text-primary">—</p>
        </Card>
      </div>

      {/* Tasks */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-sm font-semibold text-primary">My Tasks</h2>
        </div>
        <p className="px-5 py-6 text-sm text-secondary text-center">
          {supabaseReady ? 'No tasks assigned.' : 'Connect Supabase to see your tasks.'}
        </p>
      </Card>
    </div>
  )
}
