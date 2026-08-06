'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/lib/i18n/LocaleContext'

export interface TeamMember {
  id: string
  full_name: string
  position: string | null
  openEntryId: string | null
  clockInTime: string | null
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TeamCheckin({
  members,
  supervisorId,
  companyId,
  supabaseReady,
}: {
  members: TeamMember[]
  supervisorId: string | null
  companyId: string
  supabaseReady: boolean
}) {
  const router = useRouter()
  const { t } = useTranslation()
  const [rows, setRows] = useState(members)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function clockIn(member: TeamMember) {
    if (!supervisorId || !supabaseReady) return
    setBusyId(member.id)
    const entryId = newId()
    const clockInIso = new Date().toISOString()

    setRows(prev => prev.map(m => (m.id === member.id ? { ...m, openEntryId: entryId, clockInTime: clockInIso } : m)))

    const supabase = createClient()
    await supabase.from('time_entries').insert({
      id: entryId,
      employee_id: member.id,
      company_id: companyId,
      clock_in: clockInIso,
      created_by: supervisorId,
    })

    setBusyId(null)
    router.refresh()
  }

  async function clockOut(member: TeamMember) {
    if (!member.openEntryId || !supabaseReady) return
    setBusyId(member.id)

    setRows(prev => prev.map(m => (m.id === member.id ? { ...m, openEntryId: null, clockInTime: null } : m)))

    const supabase = createClient()
    await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', member.openEntryId)

    setBusyId(null)
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-secondary text-center py-6">{t('employee.team.noTeamMembers')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map(member => {
        const clockedIn = !!member.clockInTime
        return (
          <Card key={member.id} padding="sm" className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {clockedIn && <span className="w-2 h-2 rounded-full bg-green flex-shrink-0" />}
                <p className="text-sm font-medium text-primary truncate">{member.full_name}</p>
              </div>
              <p className="text-xs text-secondary mt-0.5 truncate">
                {member.position || t('employee.team.noPosition')}
                {clockedIn && member.clockInTime && (
                  <>
                    {' · '}
                    {t('employee.team.sinceLabel')} {new Date(member.clockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </>
                )}
              </p>
            </div>
            {clockedIn ? (
              <Button size="sm" variant="danger" loading={busyId === member.id} onClick={() => clockOut(member)}>
                {t('employee.team.clockOut')}
              </Button>
            ) : (
              <Button size="sm" loading={busyId === member.id} onClick={() => clockIn(member)}>
                {t('employee.team.clockIn')}
              </Button>
            )}
          </Card>
        )
      })}
    </div>
  )
}
