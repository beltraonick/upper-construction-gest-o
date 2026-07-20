import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { ChangeOrdersList, type ChangeOrder } from './ChangeOrdersList'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

export default async function ClientChangeOrdersPage() {
  const user = getCurrentUser()
  if (!user) redirect('/login')

  let orders: ChangeOrder[] = []

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const { data: projs } = await supabase
        .from('projects')
        .select('id')
        .eq('company_id', COMPANY_ID)
        .eq('client_email', user.email)

      const projectIds = (projs ?? []).map(p => p.id)

      if (projectIds.length > 0) {
        const { data } = await supabase
          .from('change_orders')
          .select('id, project_id, title, description, amount, status, client_comment, created_at, project:project_id(name)')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
        orders = (data ?? []) as unknown as ChangeOrder[]
      }
    } catch {
      // silent — falls back to empty state
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary tracking-tight">Change Orders</h1>
        <p className="text-sm text-secondary mt-1">Review and approve extra work requested for your project.</p>
      </div>
      <ChangeOrdersList initialOrders={orders} supabaseReady={!!supabaseReady} />
    </div>
  )
}
