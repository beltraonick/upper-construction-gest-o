import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const supabaseReady =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')

interface CompanyRow {
  id: string
  name: string
  subscription_status: string
  created_at: string
  plan: { name: string; price_cents: number; project_limit: number | null } | null
}

function statusBadge(s: string) {
  if (s === 'active') return <Badge variant="green">Active</Badge>
  if (s === 'trialing') return <Badge variant="blue">Trialing</Badge>
  if (s === 'past_due') return <Badge variant="amber">Past Due</Badge>
  return <Badge variant="red">Canceled</Badge>
}

export default async function OwnerDashboardPage() {
  let companies: CompanyRow[] = []
  let counts = new Map<string, { admins: number; employees: number; clients: number; projects: number }>()
  let mrrCents = 0

  if (supabaseReady) {
    try {
      const supabase = createClient()
      const [{ data: companyRows }, { data: profileRows }, { data: projectRows }] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, subscription_status, created_at, plan:plan_id(name, price_cents, project_limit)')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('company_id, role'),
        supabase.from('projects').select('company_id'),
      ])

      companies = (companyRows ?? []) as unknown as CompanyRow[]

      counts = new Map()
      for (const c of companies) counts.set(c.id, { admins: 0, employees: 0, clients: 0, projects: 0 })
      for (const p of profileRows ?? []) {
        const bucket = p.company_id ? counts.get(p.company_id) : null
        if (!bucket) continue
        if (p.role === 'admin') bucket.admins++
        else if (p.role === 'employee') bucket.employees++
        else if (p.role === 'client') bucket.clients++
      }
      for (const pr of projectRows ?? []) {
        const bucket = pr.company_id ? counts.get(pr.company_id) : null
        if (bucket) bucket.projects++
      }

      mrrCents = companies
        .filter(c => c.subscription_status === 'active')
        .reduce((sum, c) => sum + (c.plan?.price_cents ?? 0), 0)
    } catch {
      // silent — falls back to empty state
    }
  }

  const activeCount = companies.filter(c => c.subscription_status === 'active').length
  const trialingCount = companies.filter(c => c.subscription_status === 'trialing').length

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Companies</h1>
        <p className="text-sm text-secondary mt-1">Every business running on OrbitOps</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <Card><p className="text-xs text-secondary uppercase tracking-wide mb-1">Companies</p><p className="text-2xl font-bold text-primary">{companies.length}</p></Card>
        <Card><p className="text-xs text-secondary uppercase tracking-wide mb-1">Active</p><p className="text-2xl font-bold text-green">{activeCount}</p></Card>
        <Card><p className="text-xs text-secondary uppercase tracking-wide mb-1">Trialing</p><p className="text-2xl font-bold text-blue">{trialingCount}</p></Card>
        <Card><p className="text-xs text-secondary uppercase tracking-wide mb-1">MRR</p><p className="text-2xl font-bold text-primary">${(mrrCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></Card>
      </div>

      <Card padding="none">
        {!supabaseReady ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">Connect Supabase to see companies.</p>
        ) : companies.length === 0 ? (
          <p className="px-5 py-10 text-sm text-secondary text-center">No companies yet.</p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {companies.map(c => {
              const bucket = counts.get(c.id) ?? { admins: 0, employees: 0, clients: 0, projects: 0 }
              return (
                <div key={c.id} className="flex items-center gap-3 px-5 py-4 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-primary truncate">{c.name}</p>
                      {statusBadge(c.subscription_status)}
                    </div>
                    <p className="text-xs text-secondary mt-0.5">
                      {c.plan ? `${c.plan.name} · $${(c.plan.price_cents / 100).toFixed(0)}/mo` : 'No plan assigned'}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs text-secondary">
                    <span>{bucket.admins} admin{bucket.admins !== 1 ? 's' : ''}</span>
                    <span>{bucket.employees} employee{bucket.employees !== 1 ? 's' : ''}</span>
                    <span>{bucket.clients} client{bucket.clients !== 1 ? 's' : ''}</span>
                    <span>
                      {bucket.projects} project{bucket.projects !== 1 ? 's' : ''}
                      {c.plan?.project_limit != null ? ` / ${c.plan.project_limit}` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-tertiary w-full sm:w-auto">
                    Since {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
