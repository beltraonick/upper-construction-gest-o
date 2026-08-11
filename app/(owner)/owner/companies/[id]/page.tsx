import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { t } from '@/lib/i18n/translate'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { subscriptionStatusKey, subscriptionStatusVariant } from '@/lib/owner-status'
import { BillingForm } from './BillingForm'
import { PeopleTable } from './PeopleTable'

const DATE_LOCALE: Record<string, string> = { en: 'en-US', pt: 'pt-BR', es: 'es-ES' }

function projectStatusVariant(status: string): 'green' | 'blue' | 'gray' | 'amber' {
  if (status === 'active') return 'green'
  if (status === 'completed') return 'blue'
  if (status === 'on_hold') return 'amber'
  return 'gray'
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-tertiary flex-shrink-0">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  )
}

export default async function OwnerCompanyDetailPage({ params }: { params: { id: string } }) {
  const user = getCurrentUser()
  if (!user || user.role !== 'owner') redirect('/login')

  const locale = user.language
  const supabase = createClient()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [{ data: company }, { data: people }, { data: projects }, { data: plans }, { data: pendingRequests }, { data: monthLogins }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, subscription_status, months_overdue, trial_ends_at, owner_notes, created_at, plan_id, plan:plan_id(name, price_cents, project_limit)')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, position, role, auth_status, last_login_at')
      .eq('company_id', params.id)
      .order('role')
      .order('full_name'),
    supabase
      .from('projects')
      .select('id, name, status, progress, created_at')
      .eq('company_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.from('plans').select('id, name, price_cents').order('price_cents'),
    supabase
      .from('membership_requests')
      .select('id, created_at, profile:profile_id(full_name, email)')
      .eq('company_id', params.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('login_events')
      .select('profile_id')
      .eq('company_id', params.id)
      .gte('created_at', monthStart.toISOString()),
  ])

  const accessesThisMonth: Record<string, number> = {}
  for (const row of monthLogins ?? []) {
    accessesThisMonth[row.profile_id] = (accessesThisMonth[row.profile_id] ?? 0) + 1
  }

  if (!company) {
    return (
      <div className="p-4 md:p-8 max-w-[1000px]">
        <Link href="/owner/dashboard" className="text-sm text-secondary hover:text-primary transition-colors">
          ‹ {t(locale, 'owner.companyDetail.back')}
        </Link>
        <p className="mt-6 text-sm text-secondary">{t(locale, 'owner.companyDetail.notFound')}</p>
      </div>
    )
  }

  const plan = company.plan as unknown as { name: string; price_cents: number; project_limit: number | null } | null

  return (
    <div className="p-4 md:p-8 max-w-[1000px] pb-20">
      <Link href="/owner/dashboard" className="text-sm text-secondary hover:text-primary transition-colors">
        ‹ {t(locale, 'owner.companyDetail.back')}
      </Link>

      <div className="mt-3 mb-6 flex items-center gap-3 flex-wrap">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">{company.name}</h1>
        <Badge variant={subscriptionStatusVariant(company.subscription_status)}>
          {t(locale, subscriptionStatusKey(company.subscription_status))}
        </Badge>
        {company.subscription_status === 'trialing' && company.trial_ends_at && (() => {
          const daysLeft = Math.ceil((new Date(company.trial_ends_at).getTime() - Date.now()) / 86400000)
          return (
            <Badge variant={daysLeft <= 3 ? 'amber' : 'gray'}>
              {daysLeft > 0
                ? `${daysLeft} ${t(locale, daysLeft === 1 ? 'owner.dashboard.trialDaySingular' : 'owner.dashboard.trialDayPlural')}`
                : t(locale, 'owner.dashboard.trialExpiredBadge')}
            </Badge>
          )
        })()}
        <Badge variant="gray">
          {plan ? `${plan.name} · $${(plan.price_cents / 100).toFixed(0)}/mo` : t(locale, 'owner.dashboard.noPlan')}
        </Badge>
        <span className="text-xs text-tertiary">
          {t(locale, 'owner.dashboard.since')} {new Date(company.created_at).toLocaleDateString(DATE_LOCALE[locale], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-primary mb-3">{t(locale, 'owner.companyDetail.billingTitle')}</h2>
        <BillingForm
          companyId={company.id}
          initialStatus={company.subscription_status}
          initialMonthsOverdue={company.months_overdue ?? 0}
          initialNotes={company.owner_notes ?? ''}
          initialPlanId={company.plan_id}
          plans={plans ?? []}
        />
      </Card>

      {pendingRequests && pendingRequests.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-primary mb-3">{t(locale, 'owner.companyDetail.pendingRequestsTitle')}</h2>
          <div className="space-y-2">
            {pendingRequests.map(r => {
              const profile = r.profile as unknown as { full_name: string; email: string } | null
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-primary">{profile?.full_name ?? '—'} <span className="text-secondary">· {profile?.email}</span></span>
                  <span className="text-xs text-tertiary">
                    {new Date(r.created_at).toLocaleDateString(DATE_LOCALE[locale], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card padding="none" className="mb-6">
        <h2 className="text-sm font-semibold text-primary px-5 pt-4 pb-3">{t(locale, 'owner.companyDetail.peopleTitle')}</h2>
        <PeopleTable people={people ?? []} accessesThisMonth={accessesThisMonth} />
      </Card>

      <Card padding="none">
        <h2 className="text-sm font-semibold text-primary px-5 pt-4 pb-3">{t(locale, 'owner.companyDetail.projectsTitle')}</h2>
        {!projects || projects.length === 0 ? (
          <p className="px-5 py-8 text-sm text-secondary text-center">{t(locale, 'owner.companyDetail.noProjects')}</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {projects.map(p => (
              <Link
                key={p.id}
                href={`/owner/companies/${company.id}/projects/${p.id}`}
                className="flex items-center gap-3 px-5 py-3.5 flex-wrap hover:bg-surface-elevated transition-colors"
              >
                <p className="flex-1 min-w-[160px] text-sm font-medium text-primary truncate">{p.name}</p>
                <Badge variant={projectStatusVariant(p.status)}>{p.status}</Badge>
                <span className="text-xs text-secondary w-24">{p.progress ?? 0}%</span>
                <span className="text-xs text-tertiary">
                  {new Date(p.created_at).toLocaleDateString(DATE_LOCALE[locale], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <ChevronRight />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
