'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface ChangeOrder {
  id: string
  project_id: string
  title: string
  description: string | null
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  client_comment: string | null
  created_at: string
  project?: { name: string } | null
}

function statusBadge(s: string) {
  if (s === 'approved') return <Badge variant="green">Approved</Badge>
  if (s === 'rejected') return <Badge variant="red">Declined</Badge>
  return <Badge variant="amber">Awaiting your review</Badge>
}

export function ChangeOrdersList({
  initialOrders,
  supabaseReady,
}: {
  initialOrders: ChangeOrder[]
  supabaseReady: boolean
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    const supabase = createClient()
    const comment = comments[id]?.trim() || null
    const { error } = await supabase
      .from('change_orders')
      .update({ status, client_comment: comment, decided_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, status, client_comment: comment } : o)))
    }
    setBusyId(null)
  }

  async function saveComment(id: string) {
    setBusyId(id)
    const supabase = createClient()
    const comment = comments[id]?.trim() || null
    const { error } = await supabase.from('change_orders').update({ client_comment: comment }).eq('id', id)
    if (!error) {
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, client_comment: comment } : o)))
    }
    setBusyId(null)
  }

  if (!supabaseReady) {
    return (
      <Card>
        <p className="text-sm text-secondary text-center py-6">Connect Supabase to see change orders.</p>
      </Card>
    )
  }

  if (orders.length === 0) {
    return (
      <Card>
        <p className="text-sm text-secondary text-center py-10">No change orders yet. You&apos;ll see extra work here as soon as it&apos;s requested.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map(o => (
        <Card key={o.id} padding="none">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-primary truncate">{o.title}</h3>
                {o.project?.name && <p className="text-xs text-tertiary mt-0.5">{o.project.name}</p>}
              </div>
              {statusBadge(o.status)}
            </div>

            {o.description && <p className="text-sm text-secondary mb-3">{o.description}</p>}

            <p className="text-lg font-bold text-primary mb-4">
              ${Number(o.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>

            {o.status === 'pending' ? (
              <div className="space-y-3">
                <textarea
                  className="w-full rounded-input bg-surface-elevated border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60"
                  rows={2}
                  placeholder="Add a comment (optional)"
                  value={comments[o.id] ?? ''}
                  onChange={e => setComments(c => ({ ...c, [o.id]: e.target.value }))}
                />
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    className="flex-1"
                    loading={busyId === o.id}
                    onClick={() => decide(o.id, 'rejected')}
                  >
                    Decline
                  </Button>
                  <Button
                    className="flex-1"
                    loading={busyId === o.id}
                    onClick={() => decide(o.id, 'approved')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {o.client_comment && (
                  <p className="text-sm text-secondary italic bg-surface-elevated rounded-input px-3 py-2">
                    &ldquo;{o.client_comment}&rdquo;
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-input bg-surface-elevated border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand/40"
                    placeholder="Edit comment…"
                    value={comments[o.id] ?? o.client_comment ?? ''}
                    onChange={e => setComments(c => ({ ...c, [o.id]: e.target.value }))}
                  />
                  <Button variant="secondary" size="sm" loading={busyId === o.id} onClick={() => saveComment(o.id)}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
