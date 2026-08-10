// Shared between the owner dashboard, company detail header, and the
// billing form's status picker so "what does this status mean" reads
// the same everywhere instead of raw enum values like "past_due".

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'canceled']

export function subscriptionStatusVariant(status: string): 'green' | 'blue' | 'amber' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'trialing') return 'blue'
  if (status === 'past_due') return 'amber'
  return 'gray'
}

export function subscriptionStatusKey(status: string): string {
  if (status === 'active') return 'owner.dashboard.statusActive'
  if (status === 'trialing') return 'owner.dashboard.statusTrialing'
  if (status === 'past_due') return 'owner.dashboard.statusPastDue'
  return 'owner.dashboard.statusCanceled'
}

// "Overdue" is real, not a disconnected manual counter: a company only
// counts as overdue when its status says so (past_due), or when the
// owner has explicitly logged months owed even outside that status.
export function isCompanyOverdue(status: string, monthsOverdue: number | null | undefined): boolean {
  return status === 'past_due' || (monthsOverdue ?? 0) > 0
}
